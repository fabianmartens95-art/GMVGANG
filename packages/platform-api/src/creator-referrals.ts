import type { CreatorProfile, ReferralAttribution, ReferralStatus } from "@gmvgang/platform-foundation";
import type { CreatorReferralHubReadModel } from "./types.js";

const REFERRAL_STATUSES: readonly ReferralStatus[] = [
  "attributed",
  "profile_complete",
  "qualified",
  "contracted",
  "active",
  "performing",
  "rejected",
  "fraud_review",
];

const RECENT_REFERRAL_LIMIT = 20;

export function emptyReferralStatusCounts(): Record<ReferralStatus, number> {
  return Object.fromEntries(REFERRAL_STATUSES.map((status) => [status, 0])) as Record<ReferralStatus, number>;
}

export function buildCreatorReferralHubReadModel(
  creatorProfile: CreatorProfile,
  attributions: readonly ReferralAttribution[],
): CreatorReferralHubReadModel {
  const referralCode = creatorProfile.referralCode.trim();
  if (!referralCode) throw new Error("CREATOR_REFERRAL_CODE_REQUIRED");

  const statusCounts = emptyReferralStatusCounts();
  for (const attribution of attributions) {
    if (attribution.referrerCreatorProfileId !== creatorProfile.id) {
      throw new Error("CREATOR_REFERRAL_OWNER_MISMATCH");
    }
    if (attribution.referralCode !== referralCode) {
      throw new Error("CREATOR_REFERRAL_CODE_MISMATCH");
    }
    statusCounts[attribution.status] += 1;
  }

  const recentReferrals = [...attributions]
    .sort((left, right) => Date.parse(right.attributedAt) - Date.parse(left.attributedAt))
    .slice(0, RECENT_REFERRAL_LIMIT)
    .map((attribution) => ({
      status: attribution.status,
      attributedAt: attribution.attributedAt,
      ...(attribution.qualifiedAt ? { qualifiedAt: attribution.qualifiedAt } : {}),
      ...(attribution.contractedAt ? { contractedAt: attribution.contractedAt } : {}),
      ...(attribution.activatedAt ? { activatedAt: attribution.activatedAt } : {}),
      ...(attribution.performingAt ? { performingAt: attribution.performingAt } : {}),
    }));

  return {
    referralCode,
    totalReferrals: attributions.length,
    statusCounts,
    recentReferrals,
  };
}
