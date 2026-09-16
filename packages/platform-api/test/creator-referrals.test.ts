import { describe, expect, it } from "vitest";
import type { CreatorProfile, ReferralAttribution } from "@gmvgang/platform-foundation";
import { buildCreatorReferralHubReadModel } from "../src/creator-referrals.js";

const profile: CreatorProfile = {
  id: "creator-1",
  userId: "private-user-1",
  tiktokHandle: "creator.one",
  networkStatus: "profile_complete",
  profileCompletionPercent: 100,
  referralCode: "GMVABC123",
  createdAt: "2026-09-16T09:00:00.000Z",
  updatedAt: "2026-09-16T09:00:00.000Z",
};

function attribution(id: string, status: ReferralAttribution["status"], attributedAt: string): ReferralAttribution {
  return {
    id,
    referrerCreatorProfileId: "creator-1",
    referredCreatorProfileId: `private-referred-${id}`,
    referralCode: "GMVABC123",
    status,
    attributedAt,
    fraudFlags: status === "fraud_review" ? ["private-fraud-signal"] : [],
    createdAt: attributedAt,
    updatedAt: attributedAt,
  };
}

describe("buildCreatorReferralHubReadModel", () => {
  it("returns aggregate milestones and anonymous recent referrals only", () => {
    const model = buildCreatorReferralHubReadModel(profile, [
      attribution("1", "qualified", "2026-09-16T10:00:00.000Z"),
      attribution("2", "fraud_review", "2026-09-16T11:00:00.000Z"),
    ]);

    expect(model.totalReferrals).toBe(2);
    expect(model.statusCounts.qualified).toBe(1);
    expect(model.statusCounts.fraud_review).toBe(1);
    expect(model.recentReferrals[0]?.status).toBe("fraud_review");
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("private-user-1");
    expect(serialized).not.toContain("private-referred");
    expect(serialized).not.toContain("private-fraud-signal");
  });

  it("fails closed if an attribution belongs to another referrer", () => {
    const wrong = { ...attribution("1", "attributed", "2026-09-16T10:00:00.000Z"), referrerCreatorProfileId: "creator-2" };
    expect(() => buildCreatorReferralHubReadModel(profile, [wrong])).toThrow("CREATOR_REFERRAL_OWNER_MISMATCH");
  });

  it("fails closed if the immutable referral code does not match the profile", () => {
    const wrong = { ...attribution("1", "attributed", "2026-09-16T10:00:00.000Z"), referralCode: "OTHER123" };
    expect(() => buildCreatorReferralHubReadModel(profile, [wrong])).toThrow("CREATOR_REFERRAL_CODE_MISMATCH");
  });
});
