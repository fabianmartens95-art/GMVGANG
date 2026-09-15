import { describe, expect, it } from "vitest";
import {
  advanceReferralMilestone,
  attributeReferral,
  calculateProfileCompleteness,
  evaluateReferralRisk,
  isRewardEligible,
  normalizeTikTokHandle,
  validateCreatorRegistration,
  type ReferralAttribution,
} from "./creator-growth";

const baseProfile = {
  displayName: "Creator One",
  tiktokHandle: "@Creator.One",
  email: "CREATOR@example.com",
  ageConfirmed: true,
  privacyAccepted: true,
  followerCount: 12000,
  countryCode: "DE",
  primaryCategories: ["beauty"],
  isLiveCreator: false,
};

describe("creator growth", () => {
  it("normalizes TikTok handles", () => {
    expect(normalizeTikTokHandle(" @@Creator.One ")).toBe("@creator.one");
    expect(normalizeTikTokHandle("." )).toBeNull();
  });

  it("validates the public registration gate", () => {
    expect(validateCreatorRegistration(baseProfile)).toMatchObject({
      ok: true,
      normalizedHandle: "@creator.one",
      normalizedEmail: "creator@example.com",
    });

    expect(
      validateCreatorRegistration({ ...baseProfile, ageConfirmed: false }).errors,
    ).toContain("age_confirmation_required");
  });

  it("requires a fully useful profile before marking it complete", () => {
    expect(calculateProfileCompleteness(baseProfile)).toEqual({
      complete: true,
      percentage: 100,
      missingFields: [],
    });

    const incomplete = calculateProfileCompleteness({
      ...baseProfile,
      primaryCategories: [],
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missingFields).toContain("primaryCategories");
  });

  it("blocks self referrals and duplicate identities", () => {
    expect(
      evaluateReferralRisk({
        referrerCreatorId: "creator-1",
        referredCreatorId: "creator-1",
      }).decision,
    ).toBe("block");

    expect(
      evaluateReferralRisk({
        referrerCreatorId: "creator-1",
        referredCreatorId: "creator-2",
        referrerIdentityKey: "identity-x",
        referredIdentityKey: "identity-x",
      }),
    ).toMatchObject({ decision: "block", flags: ["duplicate_identity"] });
  });

  it("routes shared-device referrals to review instead of auto-accepting them", () => {
    expect(
      evaluateReferralRisk({
        referrerCreatorId: "creator-1",
        referredCreatorId: "creator-2",
        referrerDeviceKey: "device-x",
        referredDeviceKey: "device-x",
      }).decision,
    ).toBe("review");
  });

  it("locks attribution after the first valid referrer", () => {
    const first = attributeReferral({
      workspaceId: "gmvgang",
      referralCode: "ABC123",
      referrerCreatorId: "creator-1",
      referredCreatorId: "creator-2",
      attributedAt: "2026-09-16T00:00:00Z",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected valid attribution");

    expect(
      attributeReferral({
        workspaceId: "gmvgang",
        referralCode: "ZZZ999",
        referrerCreatorId: "creator-3",
        referredCreatorId: "creator-2",
        attributedAt: "2026-09-16T00:05:00Z",
        existingAttribution: first.attribution,
      }),
    ).toEqual({ ok: false, reason: "attribution_locked" });
  });

  it("never regresses referral milestones and only rewards configured events", () => {
    const attribution: ReferralAttribution = {
      workspaceId: "gmvgang",
      referralCode: "ABC123",
      referrerCreatorId: "creator-1",
      referredCreatorId: "creator-2",
      attributedAt: "2026-09-16T00:00:00Z",
      milestone: "screening_passed",
    };

    expect(advanceReferralMilestone(attribution, "profile_complete")).toEqual(attribution);
    const contracted = advanceReferralMilestone(attribution, "contracted");
    expect(contracted.milestone).toBe("contracted");
    expect(isRewardEligible(contracted, ["contracted", "first_qualified_performance"])).toBe(true);
    expect(isRewardEligible(attribution, ["contracted"])).toBe(false);
  });
});
