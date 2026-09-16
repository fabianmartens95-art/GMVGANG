import {
  advanceReferralStatus,
  assertImmutableReferralAttribution,
  createReferralAttribution,
  creatorProfileCompletionPercent,
  normalizeTikTokHandle,
  referralFraudFlags,
  transitionCreatorStatus,
  type CreatorProfile,
  type FraudSignals,
  type ReferralAttribution,
} from "@gmvgang/platform-foundation";

export type PublicCreatorRegistrationInput = {
  tiktokHandle: string;
  displayName?: string;
  market?: string;
  language?: string;
  niche?: readonly string[];
  ageConfirmed: boolean;
  privacyAccepted: boolean;
  privacyNoticeVersion: string;
  referralCode?: string;
};

export type CreatorProfileCompletionCommand = {
  tiktokHandle: string;
  displayName: string;
  market: string;
  language: string;
  niche: readonly string[];
};

export type TrustedCreatorRegistrationContext = {
  userId: string;
  now: string;
  fraudSignals?: FraudSignals;
};

export interface CreatorRegistrationRepository {
  findByUserId(userId: string): Promise<CreatorProfile | null>;
  findByTikTokHandle(normalizedHandle: string): Promise<CreatorProfile | null>;
  findByReferralCode(referralCode: string): Promise<CreatorProfile | null>;
  createProfile(profile: CreatorProfile): Promise<void>;
  updateProfile(profile: CreatorProfile): Promise<void>;
}

export interface CreatorReferralRepository {
  findByReferredCreatorProfileId(creatorProfileId: string): Promise<ReferralAttribution | null>;
  save(attribution: ReferralAttribution): Promise<void>;
  update(attribution: ReferralAttribution): Promise<void>;
}

export interface CreatorConsentRepository {
  record(input: {
    userId: string;
    ageConfirmed: true;
    privacyAccepted: true;
    privacyNoticeVersion: string;
    acceptedAt: string;
  }): Promise<void>;
}

export interface CreatorRegistrationIdPort {
  nextCreatorProfileId(): string;
  nextReferralAttributionId(): string;
  nextReferralCodeCandidate(): string;
}

export interface CreatorRegistrationAuditSink {
  record(input: {
    event:
      | "creator.registration.created"
      | "creator.registration.duplicate"
      | "creator.profile.completed"
      | "creator.referral.attributed"
      | "creator.referral.review"
      | "creator.referral.rejected";
    userId: string;
    creatorProfileId: string;
    occurredAt: string;
    metadata?: Record<string, string | boolean | string[]>;
  }): Promise<void>;
}

export type CreatorRegistrationPorts = {
  profiles: CreatorRegistrationRepository;
  referrals: CreatorReferralRepository;
  consents: CreatorConsentRepository;
  ids: CreatorRegistrationIdPort;
  audit: CreatorRegistrationAuditSink;
};

export type CreatorReferralCaptureResult =
  | { status: "none" }
  | { status: "attributed" }
  | { status: "review"; flags: string[] }
  | { status: "duplicate" }
  | { status: "rejected"; reason: string };

export type CreatorRegistrationResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      creatorProfile: CreatorProfile;
      created: boolean;
      referral: CreatorReferralCaptureResult;
    };

const HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,24}$/;
const MAX_REFERRAL_CODE_ATTEMPTS = 5;

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanNiche(value: readonly string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const cleaned = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  return cleaned.length ? cleaned : undefined;
}

function normalizeInputHandle(value: string): string | null {
  let normalized: string;
  try {
    normalized = normalizeTikTokHandle(value);
  } catch {
    return null;
  }
  if (!HANDLE_PATTERN.test(normalized)) return null;
  if (normalized.startsWith(".") || normalized.endsWith(".")) return null;
  return normalized;
}

function normalizeReferralCode(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

function assertTrustedContext(context: TrustedCreatorRegistrationContext): void {
  if (!context.userId.trim()) throw new Error("TRUSTED_USER_ID_REQUIRED");
  if (!Number.isFinite(Date.parse(context.now))) throw new Error("TRUSTED_TIMESTAMP_INVALID");
}

function validateRegistration(input: PublicCreatorRegistrationInput): {
  errors: string[];
  handle: string | null;
  referralCode: string | null;
} {
  const errors: string[] = [];
  const handle = normalizeInputHandle(input.tiktokHandle);
  const referralCode = normalizeReferralCode(input.referralCode);

  if (!handle) errors.push("invalid_tiktok_handle");
  if (!input.ageConfirmed) errors.push("age_confirmation_required");
  if (!input.privacyAccepted) errors.push("privacy_acceptance_required");
  if (!input.privacyNoticeVersion.trim()) errors.push("privacy_notice_version_required");
  if (input.displayName !== undefined && input.displayName.trim().length < 2) errors.push("invalid_display_name");
  if (input.referralCode?.trim() && !referralCode) errors.push("invalid_referral_code");

  return { errors, handle, referralCode };
}

async function generateUniqueReferralCode(ports: CreatorRegistrationPorts): Promise<string> {
  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const candidate = normalizeReferralCode(ports.ids.nextReferralCodeCandidate());
    if (!candidate) continue;
    if (!(await ports.profiles.findByReferralCode(candidate))) return candidate;
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

async function captureReferral(
  creatorProfile: CreatorProfile,
  requestedReferralCode: string | null,
  allowNewAttribution: boolean,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorReferralCaptureResult> {
  if (!requestedReferralCode) return { status: "none" };

  const existing = await ports.referrals.findByReferredCreatorProfileId(creatorProfile.id);
  const referrer = await ports.profiles.findByReferralCode(requestedReferralCode);

  if (!referrer) {
    await ports.audit.record({
      event: "creator.referral.rejected",
      userId: context.userId,
      creatorProfileId: creatorProfile.id,
      occurredAt: context.now,
      metadata: { reason: "referral_code_not_found", referralCode: requestedReferralCode },
    });
    return { status: "rejected", reason: "referral_code_not_found" };
  }

  if (existing) {
    try {
      assertImmutableReferralAttribution(existing, referrer.id, requestedReferralCode);
    } catch {
      await ports.audit.record({
        event: "creator.referral.rejected",
        userId: context.userId,
        creatorProfileId: creatorProfile.id,
        occurredAt: context.now,
        metadata: { reason: "referral_attribution_locked" },
      });
      return { status: "rejected", reason: "referral_attribution_locked" };
    }
    return { status: "duplicate" };
  }

  if (!allowNewAttribution) {
    return { status: "rejected", reason: "referral_capture_window_closed" };
  }

  if (referrer.id === creatorProfile.id) {
    return { status: "rejected", reason: "self_referral" };
  }

  const fraudFlags = referralFraudFlags(context.fraudSignals ?? {});
  const base = createReferralAttribution({
    id: ports.ids.nextReferralAttributionId(),
    referrerCreatorProfileId: referrer.id,
    referredCreatorProfileId: creatorProfile.id,
    referralCode: requestedReferralCode,
    now: context.now,
  });
  const attribution: ReferralAttribution = fraudFlags.length
    ? { ...base, status: "fraud_review", fraudFlags, updatedAt: context.now }
    : base;

  await ports.referrals.save(attribution);
  await ports.audit.record({
    event: fraudFlags.length ? "creator.referral.review" : "creator.referral.attributed",
    userId: context.userId,
    creatorProfileId: creatorProfile.id,
    occurredAt: context.now,
    metadata: { referralCode: requestedReferralCode, fraudFlags },
  });

  return fraudFlags.length ? { status: "review", flags: fraudFlags } : { status: "attributed" };
}

export async function registerCreator(
  input: PublicCreatorRegistrationInput,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorRegistrationResult> {
  assertTrustedContext(context);
  const validation = validateRegistration(input);
  if (validation.errors.length || !validation.handle) {
    return { ok: false, errors: validation.errors };
  }

  const existingByUser = await ports.profiles.findByUserId(context.userId);
  const existingByHandle = await ports.profiles.findByTikTokHandle(validation.handle);

  if (existingByHandle && existingByHandle.userId !== context.userId) {
    return { ok: false, errors: ["tiktok_handle_already_registered"] };
  }

  if (existingByUser) {
    if (existingByUser.tiktokHandle !== validation.handle) {
      return { ok: false, errors: ["creator_account_already_registered"] };
    }
    await ports.consents.record({
      userId: context.userId,
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: input.privacyNoticeVersion.trim(),
      acceptedAt: context.now,
    });
    const referral = await captureReferral(existingByUser, validation.referralCode, false, context, ports);
    await ports.audit.record({
      event: "creator.registration.duplicate",
      userId: context.userId,
      creatorProfileId: existingByUser.id,
      occurredAt: context.now,
    });
    return { ok: true, creatorProfile: existingByUser, created: false, referral };
  }

  const displayName = cleanOptional(input.displayName);
  const market = cleanOptional(input.market);
  const language = cleanOptional(input.language);
  const niche = cleanNiche(input.niche);
  const completionInput = {
    tiktokHandle: validation.handle,
    ...(displayName ? { displayName } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(niche ? { niche } : {}),
  };

  const draft: CreatorProfile = {
    id: ports.ids.nextCreatorProfileId(),
    userId: context.userId,
    tiktokHandle: validation.handle,
    ...(displayName ? { displayName } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(niche ? { niche } : {}),
    networkStatus: "registered",
    profileCompletionPercent: creatorProfileCompletionPercent(completionInput),
    referralCode: await generateUniqueReferralCode(ports),
    createdAt: context.now,
    updatedAt: context.now,
  };

  await ports.profiles.createProfile(draft);
  await ports.consents.record({
    userId: context.userId,
    ageConfirmed: true,
    privacyAccepted: true,
    privacyNoticeVersion: input.privacyNoticeVersion.trim(),
    acceptedAt: context.now,
  });

  const referral = await captureReferral(draft, validation.referralCode, true, context, ports);
  await ports.audit.record({
    event: "creator.registration.created",
    userId: context.userId,
    creatorProfileId: draft.id,
    occurredAt: context.now,
    metadata: { profileComplete: draft.profileCompletionPercent === 100 },
  });

  return { ok: true, creatorProfile: draft, created: true, referral };
}

export async function completeCreatorProfile(
  input: CreatorProfileCompletionCommand,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorProfile> {
  assertTrustedContext(context);
  const handle = normalizeInputHandle(input.tiktokHandle);
  if (!handle) throw new Error("INVALID_TIKTOK_HANDLE");
  if (input.displayName.trim().length < 2) throw new Error("DISPLAY_NAME_REQUIRED");
  if (!input.market.trim()) throw new Error("MARKET_REQUIRED");
  if (!input.language.trim()) throw new Error("LANGUAGE_REQUIRED");
  const niche = cleanNiche(input.niche);
  if (!niche) throw new Error("NICHE_REQUIRED");

  const current = await ports.profiles.findByUserId(context.userId);
  if (!current) throw new Error("CREATOR_PROFILE_NOT_FOUND");

  const handleOwner = await ports.profiles.findByTikTokHandle(handle);
  if (handleOwner && handleOwner.id !== current.id) throw new Error("TIKTOK_HANDLE_ALREADY_REGISTERED");

  let updated: CreatorProfile = {
    ...current,
    tiktokHandle: handle,
    displayName: input.displayName.trim(),
    market: input.market.trim(),
    language: input.language.trim(),
    niche,
    profileCompletionPercent: 100,
    updatedAt: context.now,
  };

  if (updated.networkStatus === "registered") {
    updated = transitionCreatorStatus(updated, "profile_complete", context.now);
  }

  await ports.profiles.updateProfile(updated);

  const attribution = await ports.referrals.findByReferredCreatorProfileId(updated.id);
  if (attribution?.status === "attributed") {
    await ports.referrals.update(advanceReferralStatus(attribution, "profile_complete", context.now));
  }

  await ports.audit.record({
    event: "creator.profile.completed",
    userId: context.userId,
    creatorProfileId: updated.id,
    occurredAt: context.now,
  });

  return updated;
}
