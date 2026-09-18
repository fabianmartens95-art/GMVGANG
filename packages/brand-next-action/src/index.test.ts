import { describe, expect, it } from "vitest";

import { recommendBrandNextBestAction } from "./index.js";

const ready = {
  onboardingComplete: true,
  workspaceMode: "full_access" as const,
  tiktokState: "connected" as const,
  activeProducts: 1,
  activeCampaigns: 1,
  pendingCreatorMatches: 0,
  campaignActionsRequired: 0,
};

describe("recommendBrandNextBestAction", () => {
  it("prioritizes onboarding before entitlement and commerce work", () => {
    expect(recommendBrandNextBestAction({
      ...ready,
      onboardingComplete: false,
      workspaceMode: "read_only",
      tiktokState: "disconnected",
      activeProducts: 0,
    }).id).toBe("complete_brand_onboarding");
  });

  it("prioritizes read-only recovery after onboarding", () => {
    expect(recommendBrandNextBestAction({
      ...ready,
      workspaceMode: "read_only",
      tiktokState: "disconnected",
    })).toMatchObject({
      id: "restore_brand_access",
      priority: "critical",
    });
  });

  it("prioritizes TikTok Shop connection health before catalog/campaign work", () => {
    expect(recommendBrandNextBestAction({
      ...ready,
      tiktokState: "disconnected",
      activeProducts: 0,
    }).id).toBe("connect_tiktok_shop");

    expect(recommendBrandNextBestAction({
      ...ready,
      tiktokState: "refresh_required",
      activeProducts: 0,
    }).id).toBe("refresh_tiktok_shop_connection");

    expect(recommendBrandNextBestAction({
      ...ready,
      tiktokState: "reconnect_required",
    }).id).toBe("reconnect_tiktok_shop");
  });

  it("requires product before first campaign", () => {
    expect(recommendBrandNextBestAction({
      ...ready,
      activeProducts: 0,
      activeCampaigns: 0,
    }).id).toBe("add_first_product");

    expect(recommendBrandNextBestAction({
      ...ready,
      activeProducts: 2,
      activeCampaigns: 0,
    }).id).toBe("launch_first_campaign");
  });

  it("prioritizes required campaign actions before Creator-match review", () => {
    expect(recommendBrandNextBestAction({
      ...ready,
      campaignActionsRequired: 2,
      pendingCreatorMatches: 3,
    }).id).toBe("resolve_campaign_action");

    expect(recommendBrandNextBestAction({
      ...ready,
      pendingCreatorMatches: 3,
    }).id).toBe("review_creator_matches");
  });

  it("falls back to monitoring active campaigns", () => {
    expect(recommendBrandNextBestAction(ready)).toEqual({
      id: "monitor_active_campaigns",
      priority: "normal",
      reason: "Die Kernkonfiguration steht. Prüfe laufende Kampagnen, Creator-Performance und nächste Optimierungen.",
    });
  });

  it("fails closed on malformed counters", () => {
    expect(() => recommendBrandNextBestAction({
      ...ready,
      activeProducts: -1,
    })).toThrow("BRAND_NBA_PRODUCT_COUNT_INVALID");

    expect(() => recommendBrandNextBestAction({
      ...ready,
      pendingCreatorMatches: 1.5,
    })).toThrow("BRAND_NBA_CREATOR_MATCH_COUNT_INVALID");
  });
});
