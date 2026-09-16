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
  listByReferrerCreatorProfileId(creatorProfileId: string): Promise<ReferralAttribution[]>;
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
  if (input.referralCode?.trim() && !referralCode) errors.push("invalid_referral_code");

  return { errors, handle, referralCode };
}

async function allocateReferralCode(ports: CreatorRegistrationPorts): Promise<string> {
  for (let attempt = 0; attempt < MAX_REFERRAL_CODE_ATTEMPTS; attempt += 1) {
    const candidate = ports.ids.nextReferralCodeCandidate().trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(candidate)) throw new Error("INVALID_GENERATED_REFERRAL_CODE");
    if (!await ports.profiles.findByReferralCode(candidate)) return candidate;
  }
  throw new Error("REFERRAL_CODE_ALLOCATION_FAILED");
}

async function captureReferral(
  newProfile: CreatorProfile,
  referralCode: string | null,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorReferralCaptureResult> {
  if (!referralCode) return { status: "none" };

  const existingAttribution = await ports.referrals.findByReferredCreatorProfileId(newProfile.id);
  if (existingAttribution) {
    const requestedReferrer = await ports.profiles.findByReferralCode(referralCode);
    if (!requestedReferrer) return { status: "duplicate" };
    assertImmutableReferralAttribution(existingAttribution, requestedReferrer.id, referralCode);
    return { status: "duplicate" };
  }

  const referrer = await ports.profiles.findByReferralCode(referralCode);
  if (!referrer) return { status: "rejected", reason: "referral_code_not_found" };
  if (referrer.id === newProfile.id || referrer.userId === newProfile.userId) {
    return { status: "rejected", reason: "self_referral" };
  }

  const flags = referralFraudFlags(context.fraudSignals ?? {});
  const attribution = createReferralAttribution({
    id: ports.ids.nextReferralAttributionId(),
    referrerCreatorProfileId: referrer.id,
    referredCreatorProfileId: newProfile.id,
    referralCode,
    now: context.now,
  });

  const withFlags: ReferralAttribution = flags.length
    ? { ...attribution, status: "fraud_review", fraudFlags: flags }
    : attribution;
  await ports.referrals.save(withFlags);
  await ports.audit.record({
    event: flags.length ? "creator.referral.review" : "creator.referral.attributed",
    userId: context.userId,
    creatorProfileId: newProfile.id,
    occurredAt: context.now,
    metadata: flags.length ? { flags } : { referralCode },
  });

  return flags.length ? { status: "review", flags } : { status: "attributed" };
}

export async function registerCreator(
  input: PublicCreatorRegistrationInput,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorRegistrationResult> {
  assertTrustedContext(context);
  const validation = validateRegistration(input);
  if (validation.errors.length) return { ok: false, errors: validation.errors };
  const handle = validation.handle!;

  const existingByUser = await ports.profiles.findByUserId(context.userId);
  if (existingByUser) {
    if (existingByUser.tiktokHandle !== handle) {
      return { ok: false, errors: ["user_already_registered"] };
    }
    await ports.audit.record({
      event: "creator.registration.duplicate",
      userId: context.userId,
      creatorProfileId: existingByUser.id,
      occurredAt: context.now,
    });
    return { ok: true, creatorProfile: existingByUser, created: false, referral: { status: "duplicate" } };
  }

  const existingHandle = await ports.profiles.findByTikTokHandle(handle);
  if (existingHandle) return { ok: false, errors: ["tiktok_handle_already_registered"] };

  const referralCode = await allocateReferralCode(ports);
  const displayName = cleanOptional(input.displayName);
  const market = cleanOptional(input.market);
  const language = cleanOptional(input.language);
  const niche = cleanNiche(input.niche);
  const profileDraft = {
    tiktokHandle: handle,
    ...(displayName ? { displayName } : {}),
    ...(market ? { market } : {}),
    ...(language ? { language } : {}),
    ...(niche ? { niche } : {}),
  };
  const profile: CreatorProfile = {
    id: ports.ids.nextCreatorProfileId(),
    userId: context.userId,
    ...profileDraft,
    networkStatus: "registered",
    profileCompletionPercent: creatorProfileCompletionPercent(profileDraft),
    referralCode,
    createdAt: context.now,
    updatedAt: context.now,
  };

  await ports.profiles.createProfile(profile);
  await ports.consents.record({
    userId: context.userId,
    ageConfirmed: true,
    privacyAccepted: true,
    privacyNoticeVersion: input.privacyNoticeVersion.trim(),
    acceptedAt: context.now,
  });
  await ports.audit.record({
    event: "creator.registration.created",
    userId: context.userId,
    creatorProfileId: profile.id,
    occurredAt: context.now,
  });

  const referral = await captureReferral(profile, validation.referralCode, context, ports);
  return { ok: true, creatorProfile: profile, created: true, referral };
}

export async function completeCreatorProfile(
  input: CreatorProfileCompletionCommand,
  context: TrustedCreatorRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<CreatorProfile> {
  assertTrustedContext(context);
  const existing = await ports.profiles.findByUserId(context.userId);
  if (!existing) throw new Error("CREATOR_PROFILE_NOT_FOUND");

  const handle = normalizeInputHandle(input.tiktokHandle);
  if (!handle) throw new Error("INVALID_TIKTOK_HANDLE");
  const conflictingHandle = await ports.profiles.findByTikTokHandle(handle);
  if (conflictingHandle && conflictingHandle.id !== existing.id) throw new Error("TIKTOK_HANDLE_ALREADY_REGISTERED");

  const displayName = cleanOptional(input.displayName);
  const market = cleanOptional(input.market);
  const language = cleanOptional(input.language);
  const niche = cleanNiche(input.niche);
  if (!displayName) throw new Error("DISPLAY_NAME_REQUIRED");
  if (!market) throw new Error("MARKET_REQUIRED");
  if (!language) throw new Error("LANGUAGE_REQUIRED");
  if (!niche) throw new Error("NICHE_REQUIRED");

  const updatedProfile: CreatorProfile = {
    ...existing,
    tiktokHandle: handle,
    displayName,
    market,
    language,
    niche,
    profileCompletionPercent: 100,
    networkStatus: existing.networkStatus === "registered"
      ? transitionCreatorStatus(existing, "profile_complete", context.now).networkStatus
      : existing.networkStatus,
    updatedAt: context.now,
  };

  await ports.profiles.updateProfile(updatedProfile);
  await ports.audit.record({
    event: "creator.profile.completed",
    userId: context.userId,
    creatorProfileId: existing.id,
    occurredAt: context.now,
  });

  const referral = await ports.referrals.findByReferredCreatorProfileId(existing.id);
  if (referral && referral.status === "attributed") {
    await ports.referrals.update(advanceReferralStatus(referral, "profile_complete", context.now));
  }

  return updatedProfile;
}
