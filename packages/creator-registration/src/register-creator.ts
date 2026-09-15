import {
  attributeReferral,
  evaluateReferralRisk,
  normalizeReferralCode,
  validateCreatorRegistration,
  type CreatorRegistrationInput,
  type ReferralAttribution,
  type ReferralRiskDecision,
  type ReferralRiskInput
} from "@gmvgang/creator-growth";

export type TrustedRegistrationContext = {
  workspaceId: string;
  principalId: string;
  identityKey: string;
  deviceKey?: string;
  occurredAt: string;
};

export type CreatorRegistrationRecord = {
  creatorId: string;
  created: boolean;
};

export type ReferrerRecord = {
  creatorId: string;
  identityKey?: string;
  deviceKey?: string;
};

export type StoredReferralAttribution = ReferralAttribution & {
  reviewRequired: boolean;
  riskFlags: ReferralRiskDecision["flags"];
};

export interface CreatorRegistrationRepository {
  upsertRegistration(input: {
    workspaceId: string;
    principalId: string;
    identityKey: string;
    displayName: string;
    normalizedHandle: string;
    normalizedEmail: string;
    occurredAt: string;
  }): Promise<CreatorRegistrationRecord>;
}

export interface ReferralRegistrationRepository {
  resolveReferralCode(code: string): Promise<ReferrerRecord | null>;
  getAttributionForReferredCreator(creatorId: string): Promise<StoredReferralAttribution | null>;
  saveAttribution(attribution: StoredReferralAttribution): Promise<void>;
}

export interface RegistrationAuditSink {
  record(event: {
    event: "creator.registration.accepted" | "creator.referral.attributed" | "creator.referral.rejected";
    workspaceId: string;
    creatorId: string;
    principalId: string;
    occurredAt: string;
    metadata?: Record<string, string | boolean | string[]>;
  }): Promise<void>;
}

export type CreatorRegistrationPorts = {
  creators: CreatorRegistrationRepository;
  referrals: ReferralRegistrationRepository;
  audit: RegistrationAuditSink;
};

export type RegistrationResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      creatorId: string;
      created: boolean;
      referral:
        | { status: "none" }
        | { status: "attributed"; reviewRequired: boolean }
        | { status: "rejected"; reason: string };
    };

export async function registerCreator(
  input: CreatorRegistrationInput,
  context: TrustedRegistrationContext,
  ports: CreatorRegistrationPorts,
): Promise<RegistrationResult> {
  const validation = validateCreatorRegistration(input);
  if (!validation.ok || !validation.normalizedHandle || !validation.normalizedEmail) {
    return { ok: false, errors: validation.errors };
  }

  const creator = await ports.creators.upsertRegistration({
    workspaceId: context.workspaceId,
    principalId: context.principalId,
    identityKey: context.identityKey,
    displayName: input.displayName.trim(),
    normalizedHandle: validation.normalizedHandle,
    normalizedEmail: validation.normalizedEmail,
    occurredAt: context.occurredAt,
  });

  await ports.audit.record({
    event: "creator.registration.accepted",
    workspaceId: context.workspaceId,
    creatorId: creator.creatorId,
    principalId: context.principalId,
    occurredAt: context.occurredAt,
    metadata: { created: creator.created },
  });

  const referralCode = normalizeReferralCode(input.referralCode);
  if (!referralCode) {
    return { ok: true, creatorId: creator.creatorId, created: creator.created, referral: { status: "none" } };
  }

  const referrer = await ports.referrals.resolveReferralCode(referralCode);
  if (!referrer) {
    await ports.audit.record({
      event: "creator.referral.rejected",
      workspaceId: context.workspaceId,
      creatorId: creator.creatorId,
      principalId: context.principalId,
      occurredAt: context.occurredAt,
      metadata: { reason: "referral_code_not_found", referralCode },
    });
    return {
      ok: true,
      creatorId: creator.creatorId,
      created: creator.created,
      referral: { status: "rejected", reason: "referral_code_not_found" },
    };
  }

  const riskInput: ReferralRiskInput = {
    referrerCreatorId: referrer.creatorId,
    referredCreatorId: creator.creatorId,
    referredIdentityKey: context.identityKey,
  };
  if (referrer.identityKey) riskInput.referrerIdentityKey = referrer.identityKey;
  if (referrer.deviceKey) riskInput.referrerDeviceKey = referrer.deviceKey;
  if (context.deviceKey) riskInput.referredDeviceKey = context.deviceKey;

  const risk = evaluateReferralRisk(riskInput);
  const existingAttribution = await ports.referrals.getAttributionForReferredCreator(creator.creatorId);
  const attributionInput = {
    workspaceId: context.workspaceId,
    referralCode,
    referrerCreatorId: referrer.creatorId,
    referredCreatorId: creator.creatorId,
    attributedAt: context.occurredAt,
    risk,
  };
  const decision = existingAttribution
    ? attributeReferral({ ...attributionInput, existingAttribution })
    : attributeReferral(attributionInput);

  if (!decision.ok || risk.decision === "block") {
    const reason = !decision.ok ? decision.reason : risk.flags[0] ?? "fraud_gate";
    await ports.audit.record({
      event: "creator.referral.rejected",
      workspaceId: context.workspaceId,
      creatorId: creator.creatorId,
      principalId: context.principalId,
      occurredAt: context.occurredAt,
      metadata: { reason, referralCode, riskFlags: risk.flags },
    });
    return {
      ok: true,
      creatorId: creator.creatorId,
      created: creator.created,
      referral: { status: "rejected", reason },
    };
  }

  const stored: StoredReferralAttribution = {
    ...decision.attribution,
    reviewRequired: risk.decision === "review",
    riskFlags: risk.flags,
  };

  if (!decision.duplicate) await ports.referrals.saveAttribution(stored);

  await ports.audit.record({
    event: "creator.referral.attributed",
    workspaceId: context.workspaceId,
    creatorId: creator.creatorId,
    principalId: context.principalId,
    occurredAt: context.occurredAt,
    metadata: {
      referralCode,
      duplicate: decision.duplicate,
      reviewRequired: stored.reviewRequired,
      riskFlags: risk.flags,
    },
  });

  return {
    ok: true,
    creatorId: creator.creatorId,
    created: creator.created,
    referral: { status: "attributed", reviewRequired: stored.reviewRequired },
  };
}
