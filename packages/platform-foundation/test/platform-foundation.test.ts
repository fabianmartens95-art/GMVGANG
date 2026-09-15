import assert from "node:assert/strict";
import test from "node:test";

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

test("creator role cannot read all creators", () => {
  assert.equal(roleHasCapability("creator", "creators.read_all"), false);
  assert.equal(roleHasCapability("creator_manager", "creators.read_all"), true);
});

test("brand members can manage only brand-facing capabilities", () => {
  assert.equal(roleHasCapability("brand_member", "brand.shop_connections.manage"), true);
  assert.equal(roleHasCapability("brand_member", "platform.manage"), false);
});

test("profile completion requires all five profile groups", () => {
  assert.equal(
    creatorProfileCompletionPercent({
      tiktokHandle: "@creator",
      displayName: "Creator",
      market: "DE",
      language: "de",
      niche: ["beauty"],
    }),
    100,
  );
  assert.equal(creatorProfileCompletionPercent({ tiktokHandle: "@creator" }), 20);
});

test("tiktok handles are normalized", () => {
  assert.equal(normalizeTikTokHandle(" @Creator.Name "), "creator.name");
});

test("profile cannot become profile_complete before completion is 100 percent", () => {
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
  assert.throws(() => transitionCreatorStatus(profile, "profile_complete", NOW), /CREATOR_PROFILE_INCOMPLETE/);
});

test("self referral is rejected and attribution cannot be overwritten", () => {
  assert.throws(
    () =>
      createReferralAttribution({
        id: "ref_1",
        referrerCreatorProfileId: "cp_1",
        referredCreatorProfileId: "cp_1",
        referralCode: "ABC",
        now: NOW,
      }),
    /SELF_REFERRAL_NOT_ALLOWED/,
  );

  const attribution = createReferralAttribution({
    id: "ref_2",
    referrerCreatorProfileId: "cp_1",
    referredCreatorProfileId: "cp_2",
    referralCode: "ABC",
    now: NOW,
  });
  assert.throws(() => assertImmutableReferralAttribution(attribution, "cp_9", "XYZ"), /REFERRAL_ATTRIBUTION_IMMUTABLE/);
});

test("referral lifecycle advances one qualified step at a time", () => {
  let attribution = createReferralAttribution({
    id: "ref_3",
    referrerCreatorProfileId: "cp_1",
    referredCreatorProfileId: "cp_2",
    referralCode: "ABC",
    now: NOW,
  });
  attribution = advanceReferralStatus(attribution, "profile_complete", NOW);
  attribution = advanceReferralStatus(attribution, "qualified", NOW);
  assert.equal(attribution.status, "qualified");
  assert.equal(attribution.qualifiedAt, NOW);
  assert.throws(() => advanceReferralStatus(attribution, "active", NOW), /REFERRAL_STATUS_SKIP_NOT_ALLOWED/);
});

test("fraud signals are deterministic", () => {
  assert.deepEqual(
    referralFraudFlags({ sameTikTokHandle: true, samePayoutFingerprint: true }),
    ["same_tiktok_handle", "same_payout_fingerprint"],
  );
});

test("rewards require positive integer cents and expose an idempotency key", () => {
  const reward = createReferralReward({
    id: "reward_1",
    referralAttributionId: "ref_1",
    event: "qualified",
    amountCents: 2500,
    now: NOW,
  });
  assert.equal(reward.status, "pending");
  assert.equal(referralRewardKey("ref_1", "qualified"), "ref_1:qualified");
  assert.throws(
    () =>
      createReferralReward({
        id: "reward_2",
        referralAttributionId: "ref_1",
        event: "qualified",
        amountCents: 0,
        now: NOW,
      }),
    /INVALID_REWARD_AMOUNT/,
  );
});

test("seller connections belong to organizations and never expose raw tokens", () => {
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
  assert.doesNotThrow(() => assertConnectionOwnership(connection));
  assert.equal(canSyncConnection(connection, NOW), true);
});
