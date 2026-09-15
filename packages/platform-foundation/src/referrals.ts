import type { ReferralAttribution, ReferralReward, ReferralRewardEvent } from "./types.js";

export interface CreateReferralAttributionInput {
  id: string;
  referrerCreatorProfileId: string;
  referredCreatorProfileId: string;
  referralCode: string;
  now: string;
}

export function createReferralAttribution(input: CreateReferralAttributionInput): ReferralAttribution {
  if (input.referrerCreatorProfileId === input.referredCreatorProfileId) {
    throw new Error("SELF_REFERRAL_NOT_ALLOWED");
  }

  const referralCode = input.referralCode.trim();
  if (!referralCode) {
    throw new Error("REFERRAL_CODE_REQUIRED");
  }

  return {
    id: input.id,
    referrerCreatorProfileId: input.referrerCreatorProfileId,
    referredCreatorProfileId: input.referredCreatorProfileId,
    referralCode,
    status: "attributed",
    attributedAt: input.now,
    fraudFlags: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function assertImmutableReferralAttribution(
  existing: ReferralAttribution,
  requestedReferrerCreatorProfileId: string,
  requestedReferralCode: string,
): void {
  if (
    existing.referrerCreatorProfileId !== requestedReferrerCreatorProfileId ||
    existing.referralCode !== requestedReferralCode.trim()
  ) {
    throw new Error("REFERRAL_ATTRIBUTION_IMMUTABLE");
  }
}

const STATUS_ORDER: ReferralAttribution["status"][] = [
  "attributed",
  "profile_complete",
  "qualified",
  "contracted",
  "active",
  "performing",
];

export function advanceReferralStatus(
  attribution: ReferralAttribution,
  nextStatus: ReferralAttribution["status"],
  now: string,
): ReferralAttribution {
  if (nextStatus === "fraud_review" || nextStatus === "rejected") {
    return { ...attribution, status: nextStatus, updatedAt: now };
  }

  if (attribution.status === "fraud_review" || attribution.status === "rejected") {
    throw new Error("REFERRAL_STATUS_BLOCKED");
  }

  const currentIndex = STATUS_ORDER.indexOf(attribution.status);
  const nextIndex = STATUS_ORDER.indexOf(nextStatus);
  if (nextIndex < 0 || currentIndex < 0 || nextIndex < currentIndex) {
    throw new Error("REFERRAL_STATUS_REGRESSION_NOT_ALLOWED");
  }

  if (nextIndex > currentIndex + 1) {
    throw new Error("REFERRAL_STATUS_SKIP_NOT_ALLOWED");
  }

  const timestamps: Partial<ReferralAttribution> = {};
  if (nextStatus === "qualified") timestamps.qualifiedAt = now;
  if (nextStatus === "contracted") timestamps.contractedAt = now;
  if (nextStatus === "active") timestamps.activatedAt = now;
  if (nextStatus === "performing") timestamps.performingAt = now;

  return { ...attribution, ...timestamps, status: nextStatus, updatedAt: now };
}

export interface FraudSignals {
  sameUserId?: boolean;
  sameTikTokHandle?: boolean;
  samePayoutFingerprint?: boolean;
  sameVerifiedPhone?: boolean;
  suspiciousDeviceOrIpPattern?: boolean;
}

export function referralFraudFlags(signals: FraudSignals): string[] {
  const flags: string[] = [];
  if (signals.sameUserId) flags.push("same_user");
  if (signals.sameTikTokHandle) flags.push("same_tiktok_handle");
  if (signals.samePayoutFingerprint) flags.push("same_payout_fingerprint");
  if (signals.sameVerifiedPhone) flags.push("same_verified_phone");
  if (signals.suspiciousDeviceOrIpPattern) flags.push("suspicious_device_or_ip_pattern");
  return flags;
}

export interface CreateReferralRewardInput {
  id: string;
  referralAttributionId: string;
  event: ReferralRewardEvent;
  amountCents: number;
  now: string;
}

export function createReferralReward(input: CreateReferralRewardInput): ReferralReward {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("INVALID_REWARD_AMOUNT");
  }

  return {
    id: input.id,
    referralAttributionId: input.referralAttributionId,
    event: input.event,
    amountCents: input.amountCents,
    currency: "EUR",
    status: "pending",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function referralRewardKey(referralAttributionId: string, event: ReferralRewardEvent): string {
  return `${referralAttributionId}:${event}`;
}
