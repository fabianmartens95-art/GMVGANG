export type CreatorRegistrationInput = {
  displayName: string;
  tiktokHandle: string;
  email: string;
  ageConfirmed: boolean;
  privacyAccepted: boolean;
  referralCode?: string;
};

export type CreatorProfileInput = CreatorRegistrationInput & {
  followerCount?: number;
  countryCode?: string;
  primaryCategories?: string[];
  isLiveCreator?: boolean;
};

export type RegistrationValidation = {
  ok: boolean;
  normalizedHandle?: string;
  normalizedEmail?: string;
  errors: string[];
};

export type ProfileCompleteness = {
  complete: boolean;
  percentage: number;
  missingFields: string[];
};

export type ReferralMilestone =
  | "registered"
  | "profile_complete"
  | "screening_passed"
  | "contracted"
  | "first_qualified_performance";

export type ReferralAttribution = {
  workspaceId: string;
  referralCode: string;
  referrerCreatorId: string;
  referredCreatorId: string;
  attributedAt: string;
  milestone: ReferralMilestone;
};

export type ReferralRiskInput = {
  referrerCreatorId: string;
  referredCreatorId: string;
  referrerIdentityKey?: string;
  referredIdentityKey?: string;
  referrerDeviceKey?: string;
  referredDeviceKey?: string;
};

export type ReferralRiskDecision = {
  decision: "allow" | "review" | "block";
  flags: Array<"self_referral" | "duplicate_identity" | "shared_device">;
};

export type AttributionDecision =
  | { ok: true; attribution: ReferralAttribution; duplicate: boolean }
  | {
      ok: false;
      reason:
        | "invalid_referral_code"
        | "self_referral"
        | "duplicate_identity"
        | "attribution_locked";
    };

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;

const MILESTONE_ORDER: Record<ReferralMilestone, number> = {
  registered: 0,
  profile_complete: 1,
  screening_passed: 2,
  contracted: 3,
  first_qualified_performance: 4,
};

export function normalizeTikTokHandle(value: string): string | null {
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(normalized)) return null;
  if (normalized.startsWith(".") || normalized.endsWith(".")) return null;
  return `@${normalized}`;
}

export function normalizeReferralCode(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function validateCreatorRegistration(
  input: CreatorRegistrationInput,
): RegistrationValidation {
  const errors: string[] = [];
  const normalizedHandle = normalizeTikTokHandle(input.tiktokHandle);
  const normalizedEmail = input.email.trim().toLowerCase();

  if (input.displayName.trim().length < 2) errors.push("display_name_required");
  if (!normalizedHandle) errors.push("invalid_tiktok_handle");
  if (!EMAIL_PATTERN.test(normalizedEmail)) errors.push("invalid_email");
  if (!input.ageConfirmed) errors.push("age_confirmation_required");
  if (!input.privacyAccepted) errors.push("privacy_acceptance_required");
  if (input.referralCode && !normalizeReferralCode(input.referralCode)) {
    errors.push("invalid_referral_code");
  }

  return {
    ok: errors.length === 0,
    normalizedHandle: normalizedHandle ?? undefined,
    normalizedEmail: EMAIL_PATTERN.test(normalizedEmail) ? normalizedEmail : undefined,
    errors,
  };
}

export function calculateProfileCompleteness(
  input: CreatorProfileInput,
): ProfileCompleteness {
  const missingFields: string[] = [];
  const registration = validateCreatorRegistration(input);

  if (input.displayName.trim().length < 2) missingFields.push("displayName");
  if (!registration.normalizedHandle) missingFields.push("tiktokHandle");
  if (!registration.normalizedEmail) missingFields.push("email");
  if (!input.ageConfirmed) missingFields.push("ageConfirmed");
  if (!input.privacyAccepted) missingFields.push("privacyAccepted");
  if (input.followerCount === undefined || input.followerCount < 0) {
    missingFields.push("followerCount");
  }
  if (!input.countryCode?.trim()) missingFields.push("countryCode");
  if (!input.primaryCategories?.length) missingFields.push("primaryCategories");
  if (input.isLiveCreator === undefined) missingFields.push("isLiveCreator");

  const requiredCount = 9;
  const completedCount = requiredCount - missingFields.length;
  const percentage = Math.round((completedCount / requiredCount) * 100);

  return {
    complete: missingFields.length === 0,
    percentage,
    missingFields,
  };
}

export function evaluateReferralRisk(
  input: ReferralRiskInput,
): ReferralRiskDecision {
  const flags: ReferralRiskDecision["flags"] = [];

  if (input.referrerCreatorId === input.referredCreatorId) {
    flags.push("self_referral");
  }
  if (
    input.referrerIdentityKey &&
    input.referredIdentityKey &&
    input.referrerIdentityKey === input.referredIdentityKey
  ) {
    flags.push("duplicate_identity");
  }
  if (
    input.referrerDeviceKey &&
    input.referredDeviceKey &&
    input.referrerDeviceKey === input.referredDeviceKey
  ) {
    flags.push("shared_device");
  }

  if (flags.includes("self_referral") || flags.includes("duplicate_identity")) {
    return { decision: "block", flags };
  }
  if (flags.includes("shared_device")) return { decision: "review", flags };
  return { decision: "allow", flags };
}

export function attributeReferral(input: {
  workspaceId: string;
  referralCode: string;
  referrerCreatorId: string;
  referredCreatorId: string;
  attributedAt: string;
  existingAttribution?: ReferralAttribution;
  risk?: ReferralRiskDecision;
}): AttributionDecision {
  const referralCode = normalizeReferralCode(input.referralCode);
  if (!referralCode) return { ok: false, reason: "invalid_referral_code" };

  if (input.referrerCreatorId === input.referredCreatorId) {
    return { ok: false, reason: "self_referral" };
  }
  if (input.risk?.flags.includes("duplicate_identity")) {
    return { ok: false, reason: "duplicate_identity" };
  }

  if (input.existingAttribution) {
    const sameAttribution =
      input.existingAttribution.referrerCreatorId === input.referrerCreatorId &&
      input.existingAttribution.referralCode === referralCode;

    if (!sameAttribution) return { ok: false, reason: "attribution_locked" };
    return { ok: true, attribution: input.existingAttribution, duplicate: true };
  }

  return {
    ok: true,
    duplicate: false,
    attribution: {
      workspaceId: input.workspaceId,
      referralCode,
      referrerCreatorId: input.referrerCreatorId,
      referredCreatorId: input.referredCreatorId,
      attributedAt: input.attributedAt,
      milestone: "registered",
    },
  };
}

export function advanceReferralMilestone(
  attribution: ReferralAttribution,
  nextMilestone: ReferralMilestone,
): ReferralAttribution {
  if (MILESTONE_ORDER[nextMilestone] <= MILESTONE_ORDER[attribution.milestone]) {
    return attribution;
  }
  return { ...attribution, milestone: nextMilestone };
}

export function isRewardEligible(
  attribution: ReferralAttribution,
  eligibleMilestones: ReferralMilestone[],
): boolean {
  return eligibleMilestones.includes(attribution.milestone);
}
