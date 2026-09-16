import { describe, expect, it } from "vitest";

import type { CreatorProfile, ReferralAttribution } from "@gmvgang/platform-foundation";
import {
  completeCreatorProfile,
  registerCreator,
  type CreatorRegistrationAuditSink,
  type CreatorRegistrationPorts,
} from "../src/index.js";

function harness() {
  const profiles = new Map<string, CreatorProfile>();
  const attributions = new Map<string, ReferralAttribution>();
  const consents: Array<Record<string, unknown>> = [];
  const auditEvents: Array<Parameters<CreatorRegistrationAuditSink["record"]>[0]> = [];
  let profileId = 0;
  let attributionId = 0;
  let referralCandidate = 0;

  const ports: CreatorRegistrationPorts = {
    profiles: {
      async findByUserId(userId) {
        return [...profiles.values()].find((profile) => profile.userId === userId) ?? null;
      },
      async findByTikTokHandle(normalizedHandle) {
        return [...profiles.values()].find((profile) => profile.tiktokHandle === normalizedHandle) ?? null;
      },
      async findByReferralCode(referralCode) {
        return [...profiles.values()].find((profile) => profile.referralCode === referralCode) ?? null;
      },
      async createProfile(profile) {
        profiles.set(profile.id, profile);
      },
      async updateProfile(profile) {
        profiles.set(profile.id, profile);
      },
    },
    referrals: {
      async findByReferredCreatorProfileId(creatorProfileId) {
        return attributions.get(creatorProfileId) ?? null;
      },
      async save(attribution) {
        attributions.set(attribution.referredCreatorProfileId, attribution);
      },
      async update(attribution) {
        attributions.set(attribution.referredCreatorProfileId, attribution);
      },
    },
    consents: {
      async record(input) {
        consents.push(input);
      },
    },
    ids: {
      nextCreatorProfileId() {
        profileId += 1;
        return `creator-${profileId}`;
      },
      nextReferralAttributionId() {
        attributionId += 1;
        return `attribution-${attributionId}`;
      },
      nextReferralCodeCandidate() {
        referralCandidate += 1;
        return `CREATOR${String(referralCandidate).padStart(4, "0")}`;
      },
    },
    audit: {
      async record(input) {
        auditEvents.push(input);
      },
    },
  };

  return { ports, profiles, attributions, consents, auditEvents };
}

const baseInput = {
  tiktokHandle: "@Creator.One",
  ageConfirmed: true,
  privacyAccepted: true,
  privacyNoticeVersion: "privacy-v1",
};

const context = {
  userId: "user-1",
  now: "2026-09-16T00:00:00.000Z",
};

describe("registerCreator", () => {
  it("requires age and privacy consent before creating a profile", async () => {
    const { ports, profiles, consents } = harness();
    const result = await registerCreator(
      { ...baseInput, ageConfirmed: false, privacyAccepted: false },
      context,
      ports,
    );

    expect(result).toEqual({
      ok: false,
      errors: ["age_confirmation_required", "privacy_acceptance_required"],
    });
    expect(profiles.size).toBe(0);
    expect(consents).toHaveLength(0);
  });

  it("creates one registered profile and a durable consent record", async () => {
    const { ports, profiles, consents } = harness();
    const result = await registerCreator(baseInput, context, ports);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected registration success");
    expect(result.created).toBe(true);
    expect(result.creatorProfile.tiktokHandle).toBe("creator.one");
    expect(result.creatorProfile.networkStatus).toBe("registered");
    expect(result.creatorProfile.referralCode).toBe("CREATOR0001");
    expect(result.referral).toEqual({ status: "none" });
    expect(profiles.size).toBe(1);
    expect(consents).toEqual([
      expect.objectContaining({
        userId: "user-1",
        privacyNoticeVersion: "privacy-v1",
        ageConfirmed: true,
        privacyAccepted: true,
      }),
    ]);
  });

  it("blocks a second account from claiming an existing TikTok handle", async () => {
    const { ports, profiles } = harness();
    await registerCreator(baseInput, context, ports);

    const result = await registerCreator(
      baseInput,
      { ...context, userId: "user-2" },
      ports,
    );

    expect(result).toEqual({ ok: false, errors: ["tiktok_handle_already_registered"] });
    expect(profiles.size).toBe(1);
  });

  it("keeps repeated registration idempotent and closes late referral capture", async () => {
    const { ports } = harness();
    const first = await registerCreator(baseInput, context, ports);
    expect(first.ok).toBe(true);

    const referrer = await registerCreator(
      { ...baseInput, tiktokHandle: "referrer", displayName: "Referrer" },
      { ...context, userId: "user-referrer" },
      ports,
    );
    if (!referrer.ok) throw new Error("expected referrer registration success");

    const repeated = await registerCreator(
      { ...baseInput, referralCode: referrer.creatorProfile.referralCode },
      context,
      ports,
    );
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) throw new Error("expected duplicate registration success");
    expect(repeated.created).toBe(false);
    expect(repeated.referral).toEqual({ status: "rejected", reason: "referral_capture_window_closed" });
  });

  it("captures referral attribution once and refuses referrer rewrites", async () => {
    const { ports, attributions } = harness();
    const referrerA = await registerCreator(
      { ...baseInput, tiktokHandle: "ref.a" },
      { ...context, userId: "ref-a" },
      ports,
    );
    const referrerB = await registerCreator(
      { ...baseInput, tiktokHandle: "ref.b" },
      { ...context, userId: "ref-b" },
      ports,
    );
    if (!referrerA.ok || !referrerB.ok) throw new Error("expected referrers");

    const referred = await registerCreator(
      { ...baseInput, tiktokHandle: "referred", referralCode: referrerA.creatorProfile.referralCode },
      context,
      ports,
    );
    if (!referred.ok) throw new Error("expected referred registration");
    expect(referred.referral).toEqual({ status: "attributed" });
    expect(attributions.get(referred.creatorProfile.id)?.referrerCreatorProfileId).toBe(referrerA.creatorProfile.id);

    const rewrite = await registerCreator(
      { ...baseInput, tiktokHandle: "referred", referralCode: referrerB.creatorProfile.referralCode },
      context,
      ports,
    );
    if (!rewrite.ok) throw new Error("expected idempotent registration result");
    expect(rewrite.referral).toEqual({ status: "rejected", reason: "referral_attribution_locked" });
    expect(attributions.get(referred.creatorProfile.id)?.referrerCreatorProfileId).toBe(referrerA.creatorProfile.id);
  });

  it("sends suspicious referral signals to fraud review instead of rewarding them", async () => {
    const { ports, attributions } = harness();
    const referrer = await registerCreator(
      { ...baseInput, tiktokHandle: "referrer" },
      { ...context, userId: "ref-user" },
      ports,
    );
    if (!referrer.ok) throw new Error("expected referrer");

    const referred = await registerCreator(
      { ...baseInput, tiktokHandle: "referred", referralCode: referrer.creatorProfile.referralCode },
      { ...context, fraudSignals: { suspiciousDeviceOrIpPattern: true } },
      ports,
    );
    if (!referred.ok) throw new Error("expected referred registration");

    expect(referred.referral).toEqual({ status: "review", flags: ["suspicious_device_or_ip_pattern"] });
    expect(attributions.get(referred.creatorProfile.id)?.status).toBe("fraud_review");
  });
});

describe("completeCreatorProfile", () => {
  it("moves a complete Creator to profile_complete and advances a clean referral", async () => {
    const { ports, attributions } = harness();
    const referrer = await registerCreator(
      { ...baseInput, tiktokHandle: "referrer" },
      { ...context, userId: "ref-user" },
      ports,
    );
    if (!referrer.ok) throw new Error("expected referrer");

    const referred = await registerCreator(
      { ...baseInput, tiktokHandle: "referred", referralCode: referrer.creatorProfile.referralCode },
      context,
      ports,
    );
    if (!referred.ok) throw new Error("expected referred");

    const completed = await completeCreatorProfile(
      {
        tiktokHandle: "@Referred",
        displayName: "Referred Creator",
        market: "DE",
        language: "de",
        niche: ["beauty", "beauty", "lifestyle"],
      },
      { ...context, now: "2026-09-16T01:00:00.000Z" },
      ports,
    );

    expect(completed.profileCompletionPercent).toBe(100);
    expect(completed.networkStatus).toBe("profile_complete");
    expect(completed.niche).toEqual(["beauty", "lifestyle"]);
    expect(attributions.get(completed.id)?.status).toBe("profile_complete");
  });
});
