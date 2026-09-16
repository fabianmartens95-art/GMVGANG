import {
  createReferralReward,
  referralRewardKey,
  type ReferralAttribution,
  type ReferralReward,
  type ReferralRewardEvent,
} from "@gmvgang/platform-foundation";

export type AutomaticReferralRewardEvent = Exclude<ReferralRewardEvent, "manual_bonus">;

export type ReferralRewardPolicy = {
  events: Partial<Record<AutomaticReferralRewardEvent, {
    enabled: boolean;
    amountCents: number;
  }>>;
};

export interface ReferralRewardRepository {
  createIfAbsent(reward: ReferralReward): Promise<
    | { created: true; reward: ReferralReward }
    | { created: false; reward: ReferralReward }
  >;
}

export interface ReferralRewardIdPort {
  nextRewardId(): string;
}

export interface ReferralRewardAuditSink {
  record(input: {
    event:
      | "creator.referral_reward.created"
      | "creator.referral_reward.duplicate"
      | "creator.referral_reward.blocked";
    referralAttributionId: string;
    rewardEvent: AutomaticReferralRewardEvent;
    occurredAt: string;
    metadata?: Record<string, string | number | boolean | string[]>;
  }): Promise<void>;
}

export type ReferralRewardPorts = {
  rewards: ReferralRewardRepository;
  ids: ReferralRewardIdPort;
  audit: ReferralRewardAuditSink;
};

export type ReferralRewardEvaluation =
  | { status: "created"; reward: ReferralReward; key: string }
  | { status: "duplicate"; reward: ReferralReward; key: string }
  | { status: "blocked"; reason: string; key: string };

const STATUS_RANK: Partial<Record<ReferralAttribution["status"], number>> = {
  attributed: 0,
  profile_complete: 1,
  qualified: 2,
  contracted: 3,
  active: 4,
  performing: 5,
};

const EVENT_REQUIREMENT: Record<AutomaticReferralRewardEvent, {
  minimumStatus: "qualified" | "contracted" | "performing";
  evidenceField: "qualifiedAt" | "contractedAt" | "performingAt";
}> = {
  qualified: { minimumStatus: "qualified", evidenceField: "qualifiedAt" },
  contracted: { minimumStatus: "contracted", evidenceField: "contractedAt" },
  first_qualified_performance: { minimumStatus: "performing", evidenceField: "performingAt" },
};

function assertTimestamp(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function policyAmount(policy: ReferralRewardPolicy, event: AutomaticReferralRewardEvent): number | null {
  const configuration = policy.events[event];
  if (!configuration?.enabled) return null;
  if (!Number.isInteger(configuration.amountCents) || configuration.amountCents <= 0) {
    throw new Error("REFERRAL_REWARD_POLICY_AMOUNT_INVALID");
  }
  return configuration.amountCents;
}

function eligibilityBlockReason(
  attribution: ReferralAttribution,
  event: AutomaticReferralRewardEvent,
): string | null {
  if (attribution.status === "fraud_review") return "fraud_review";
  if (attribution.status === "rejected") return "referral_rejected";
  if (attribution.fraudFlags.length > 0) return "fraud_flags_present";

  const requirement = EVENT_REQUIREMENT[event];
  const currentRank = STATUS_RANK[attribution.status];
  const requiredRank = STATUS_RANK[requirement.minimumStatus];
  if (currentRank === undefined || requiredRank === undefined || currentRank < requiredRank) {
    return "milestone_not_reached";
  }

  const evidence = attribution[requirement.evidenceField];
  if (!evidence || !Number.isFinite(Date.parse(evidence))) return "milestone_evidence_missing";
  return null;
}

export async function evaluateReferralReward(
  input: {
    attribution: ReferralAttribution;
    event: AutomaticReferralRewardEvent;
    policy: ReferralRewardPolicy;
    now: string;
  },
  ports: ReferralRewardPorts,
): Promise<ReferralRewardEvaluation> {
  assertTimestamp(input.now, "REFERRAL_REWARD_TIMESTAMP_INVALID");
  const attributionId = input.attribution.id.trim();
  if (!attributionId) throw new Error("REFERRAL_ATTRIBUTION_ID_REQUIRED");
  const key = referralRewardKey(attributionId, input.event);

  const amountCents = policyAmount(input.policy, input.event);
  if (amountCents === null) {
    await ports.audit.record({
      event: "creator.referral_reward.blocked",
      referralAttributionId: attributionId,
      rewardEvent: input.event,
      occurredAt: input.now,
      metadata: { reason: "event_disabled" },
    });
    return { status: "blocked", reason: "event_disabled", key };
  }

  const blockReason = eligibilityBlockReason(input.attribution, input.event);
  if (blockReason) {
    await ports.audit.record({
      event: "creator.referral_reward.blocked",
      referralAttributionId: attributionId,
      rewardEvent: input.event,
      occurredAt: input.now,
      metadata: {
        reason: blockReason,
        referralStatus: input.attribution.status,
        fraudFlags: input.attribution.fraudFlags,
      },
    });
    return { status: "blocked", reason: blockReason, key };
  }

  const candidate = createReferralReward({
    id: ports.ids.nextRewardId(),
    referralAttributionId: attributionId,
    event: input.event,
    amountCents,
    now: input.now,
  });
  const persisted = await ports.rewards.createIfAbsent(candidate);

  if (!persisted.created) {
    await ports.audit.record({
      event: "creator.referral_reward.duplicate",
      referralAttributionId: attributionId,
      rewardEvent: input.event,
      occurredAt: input.now,
      metadata: {
        rewardId: persisted.reward.id,
        configuredAmountCents: amountCents,
        persistedAmountCents: persisted.reward.amountCents,
      },
    });
    return { status: "duplicate", reward: persisted.reward, key };
  }

  await ports.audit.record({
    event: "creator.referral_reward.created",
    referralAttributionId: attributionId,
    rewardEvent: input.event,
    occurredAt: input.now,
    metadata: {
      rewardId: persisted.reward.id,
      amountCents: persisted.reward.amountCents,
      currency: persisted.reward.currency,
      rewardStatus: persisted.reward.status,
    },
  });
  return { status: "created", reward: persisted.reward, key };
}

export function assertManualReferralBonusRequiresApproval(event: ReferralRewardEvent): asserts event is AutomaticReferralRewardEvent {
  if (event === "manual_bonus") throw new Error("MANUAL_REFERRAL_BONUS_REQUIRES_SEPARATE_APPROVAL");
}
