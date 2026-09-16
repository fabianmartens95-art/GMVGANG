import { describe, expect, it } from "vitest";
import type { ReferralAttribution, ReferralReward } from "@gmvgang/platform-foundation";
import {
  assertManualReferralBonusRequiresApproval,
  evaluateReferralReward,
  type ReferralRewardAuditSink,
  type ReferralRewardPolicy,
  type ReferralRewardPorts,
} from "../src/index.js";

const NOW = "2026-09-16T18:00:00.000Z";
const policy: ReferralRewardPolicy = {
  events: {
    qualified: { enabled: true, amountCents: 2500 },
    contracted: { enabled: true, amountCents: 5000 },
    first_qualified_performance: { enabled: true, amountCents: 10000 },
  },
};

function attribution(overrides: Partial<ReferralAttribution> = {}): ReferralAttribution {
  return {
    id: "attr-1",
    referrerCreatorProfileId: "creator-referrer",
    referredCreatorProfileId: "creator-referred",
    referralCode: "GMVABC123",
    status: "qualified",
    attributedAt: "2026-09-16T10:00:00.000Z",
    qualifiedAt: "2026-09-16T12:00:00.000Z",
    fraudFlags: [],
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    ...overrides,
  };
}

function harness() {
  const rewards = new Map<string, ReferralReward>();
  const audits: Array<Parameters<ReferralRewardAuditSink["record"]>[0]> = [];
  let ids = 0;

  const ports: ReferralRewardPorts = {
    rewards: {
      async createIfAbsent(reward) {
        const key = `${reward.referralAttributionId}:${reward.event}`;
        const existing = rewards.get(key);
        if (existing) return { created: false, reward: existing };
        rewards.set(key, reward);
        return { created: true, reward };
      },
    },
    ids: {
      nextRewardId() {
        ids += 1;
        return `reward-${ids}`;
      },
    },
    audit: {
      async record(input) {
        audits.push(input);
      },
    },
  };

  return { ports, rewards, audits };
}

describe("evaluateReferralReward", () => {
  it("creates a pending reward only after milestone evidence exists", async () => {
    const { ports } = harness();
    const result = await evaluateReferralReward({ attribution: attribution(), event: "qualified", policy, now: NOW }, ports);
    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("expected reward");
    expect(result.reward).toMatchObject({
      event: "qualified",
      amountCents: 2500,
      currency: "EUR",
      status: "pending",
    });
  });

  it("blocks forged milestone state without its evidence timestamp", async () => {
    const { ports } = harness();
    const result = await evaluateReferralReward({
      attribution: attribution({ qualifiedAt: undefined }),
      event: "qualified",
      policy,
      now: NOW,
    }, ports);
    expect(result).toEqual({ status: "blocked", reason: "milestone_evidence_missing", key: "attr-1:qualified" });
  });

  it("blocks fraud-review, rejected and flagged referrals before persistence", async () => {
    for (const current of [
      attribution({ status: "fraud_review" }),
      attribution({ status: "rejected" }),
      attribution({ fraudFlags: ["same_payout_fingerprint"] }),
    ]) {
      const { ports, rewards } = harness();
      const result = await evaluateReferralReward({ attribution: current, event: "qualified", policy, now: NOW }, ports);
      expect(result.status).toBe("blocked");
      expect(rewards.size).toBe(0);
    }
  });

  it("requires the correct later milestone for contracted and performing rewards", async () => {
    const contractedHarness = harness();
    await expect(evaluateReferralReward({
      attribution: attribution({ status: "contracted", contractedAt: "2026-09-16T14:00:00.000Z" }),
      event: "contracted",
      policy,
      now: NOW,
    }, contractedHarness.ports)).resolves.toMatchObject({ status: "created" });

    const performanceHarness = harness();
    await expect(evaluateReferralReward({
      attribution: attribution({
        status: "performing",
        contractedAt: "2026-09-16T14:00:00.000Z",
        activatedAt: "2026-09-16T15:00:00.000Z",
        performingAt: "2026-09-16T16:00:00.000Z",
      }),
      event: "first_qualified_performance",
      policy,
      now: NOW,
    }, performanceHarness.ports)).resolves.toMatchObject({ status: "created" });
  });

  it("is idempotent across retries and preserves the originally persisted amount", async () => {
    const { ports } = harness();
    const first = await evaluateReferralReward({ attribution: attribution(), event: "qualified", policy, now: NOW }, ports);
    const changedPolicy: ReferralRewardPolicy = { events: { qualified: { enabled: true, amountCents: 9999 } } };
    const second = await evaluateReferralReward({ attribution: attribution(), event: "qualified", policy: changedPolicy, now: NOW }, ports);

    expect(first.status).toBe("created");
    expect(second.status).toBe("duplicate");
    if (second.status !== "duplicate") throw new Error("expected duplicate");
    expect(second.reward.amountCents).toBe(2500);
  });

  it("does not create rewards for disabled events", async () => {
    const { ports, rewards } = harness();
    const result = await evaluateReferralReward({
      attribution: attribution(),
      event: "qualified",
      policy: { events: { qualified: { enabled: false, amountCents: 2500 } } },
      now: NOW,
    }, ports);
    expect(result).toEqual({ status: "blocked", reason: "event_disabled", key: "attr-1:qualified" });
    expect(rewards.size).toBe(0);
  });
});

describe("manual reward boundary", () => {
  it("keeps manual bonuses outside the automatic engine", () => {
    expect(() => assertManualReferralBonusRequiresApproval("manual_bonus")).toThrow("MANUAL_REFERRAL_BONUS_REQUIRES_SEPARATE_APPROVAL");
  });
});
