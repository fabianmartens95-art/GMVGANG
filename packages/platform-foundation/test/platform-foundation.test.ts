import { describe, expect, it } from "vitest";

import {
  advanceReferralStatus,
  assertConnectionOwnership,
  assertImmutableReferralAttribution,
  canSyncConnection,
  createReferralAttribution,
  createReferralReward,
  creatorProfileCompletionPercent,
  normalizeTikTokHandle,
  referralFraudFlags,
  referralRewardKey,
  roleHasCapability,
  transitionCreatorStatus,
  type CreatorProfile,
  type ExternalConnection,
} from "../src/index.js";

const NOW = "2026-09-16T00:30:00.000Z";

describe("platform foundation", () => {
  it("keeps internal creator access away from creator accounts", () => {
    expect(roleHasCapability("creator", "creators.read_all")).toBe(false);
    expect(roleHasCapability("creator_manager", "creators.read_all")).toBe(true);
  });

  it("limits brand members to brand-facing capabilities", () => {
    expect(roleHasCapability("brand_member", "brand.shop_connections.manage")).toBe(true);
    expect(roleHasCapability("brand_member", "platform.manage")).toBe(false);
  });

  it("calculates profile completion from required profile groups", () => {
    expect(
      creatorProfileCompletionPercent({
        tiktokHandle: "@creator",
        displayName: "Creator",
        market: "DE",
        language: "de",
        niche: ["beauty"],
      }),
    ).toBe(100);
    expect(creatorProfileCompletionPercent({ tiktokHandle: "@creator" })).toBe(20);
  });

  it("normalizes TikTok handles", () => {
    expect(normalizeTikTokHandle(" @Creator.Name ")).toBe("creator.name");
  });

  it("blocks profile_complete before completion reaches 100 percent", () => {
    const profile: CreatorProfile = {
      id: "cp_1",
      userId: "user_1",
      tiktokHandle: "creator",
      networkStatus: "registered",
      profileCompletionPercent: 80,
      referralCode: "ABC123",
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(() => transitionCreatorStatus(profile, "profile_complete", NOW)).toThrow("CREATOR_PROFILE_INCOMPLETE");
  });

  it("rejects self referrals and immutable attribution rewrites", () => {
    expect(() =>
      createReferralAttribution({
        id: "ref_1",
        referrerCreatorProfileId: "cp_1",
        referredCreatorProfileId: "cp_1",
        referralCode: "ABC",
        now: NOW,
      }),
    ).toThrow("SELF_REFERRAL_NOT_ALLOWED");

    const attribution = createReferralAttribution({
      id: "ref_2",
      referrerCreatorProfileId: "cp_1",
      referredCreatorProfileId: "cp_2",
      referralCode: "ABC",
      now: NOW,
    });

    expect(() => assertImmutableReferralAttribution(attribution, "cp_9", "XYZ")).toThrow(
      "REFERRAL_ATTRIBUTION_IMMUTABLE",
    );
  });

  it("advances referral lifecycle one qualified step at a time", () => {
    let attribution = createReferralAttribution({
      id: "ref_3",
      referrerCreatorProfileId: "cp_1",
      referredCreatorProfileId: "cp_2",
      referralCode: "ABC",
      now: NOW,
    });

    attribution = advanceReferralStatus(attribution, "profile_complete", NOW);
    attribution = advanceReferralStatus(attribution, "qualified", NOW);

    expect(attribution.status).toBe("qualified");
    expect(attribution.qualifiedAt).toBe(NOW);
    expect(() => advanceReferralStatus(attribution, "active", NOW)).toThrow("REFERRAL_STATUS_SKIP_NOT_ALLOWED");
  });

  it("derives deterministic fraud flags", () => {
    expect(referralFraudFlags({ sameTikTokHandle: true, samePayoutFingerprint: true })).toEqual([
      "same_tiktok_handle",
      "same_payout_fingerprint",
    ]);
  });

  it("requires positive integer reward cents and exposes an idempotency key", () => {
    const reward = createReferralReward({
      id: "reward_1",
      referralAttributionId: "ref_1",
      event: "qualified",
      amountCents: 2500,
      now: NOW,
    });

    expect(reward.status).toBe("pending");
    expect(referralRewardKey("ref_1", "qualified")).toBe("ref_1:qualified");
    expect(() =>
      createReferralReward({
        id: "reward_2",
        referralAttributionId: "ref_1",
        event: "qualified",
        amountCents: 0,
        now: NOW,
      }),
    ).toThrow("INVALID_REWARD_AMOUNT");
  });

  it("models seller connections as organization-owned syncable connections", () => {
    const connection: ExternalConnection = {
      id: "conn_1",
      ownerType: "organization",
      ownerId: "org_1",
      provider: "tiktok_shop_seller",
      status: "connected",
      grantedScopes: ["orders.read"],
      accessTokenSecretRef: "secret://seller/access",
      refreshTokenSecretRef: "secret://seller/refresh",
      tokenExpiresAt: "2026-09-16T01:30:00.000Z",
      createdAt: NOW,
      updatedAt: NOW,
    };

    expect(() => assertConnectionOwnership(connection)).not.toThrow();
    expect(canSyncConnection(connection, NOW)).toBe(true);
  });
});
