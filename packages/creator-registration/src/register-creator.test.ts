import { describe, expect, it } from "vitest";
import {
  registerCreator,
  type CreatorRegistrationPorts,
  type StoredReferralAttribution,
} from "./register-creator";

const registration = {
  displayName: "Creator One",
  tiktokHandle: "@creator.one",
  email: "creator@example.com",
  ageConfirmed: true,
  privacyAccepted: true,
};

function createPorts(options: {
  creatorId?: string;
  referrer?: { creatorId: string; identityKey?: string; deviceKey?: string } | null;
  existing?: StoredReferralAttribution | null;
} = {}) {
  const saved: StoredReferralAttribution[] = [];
  const audit: string[] = [];

  const ports: CreatorRegistrationPorts = {
    creators: {
      async upsertRegistration() {
        return { creatorId: options.creatorId ?? "creator-new", created: true };
      },
    },
    referrals: {
      async resolveReferralCode() {
        return options.referrer === undefined
          ? { creatorId: "creator-referrer", identityKey: "identity-referrer" }
          : options.referrer;
      },
      async getAttributionForReferredCreator() {
        return options.existing ?? null;
      },
      async saveAttribution(attribution) {
        saved.push(attribution);
      },
    },
    audit: {
      async record(event) {
        audit.push(event.event);
      },
    },
  };

  return { ports, saved, audit };
}

const context = {
  workspaceId: "gmvgang",
  principalId: "principal-1",
  identityKey: "identity-new",
  deviceKey: "device-new",
  occurredAt: "2026-09-16T00:00:00Z",
};

describe("creator registration command", () => {
  it("rejects invalid public registration before SSOT writes", async () => {
    const { ports, audit } = createPorts();
    const result = await registerCreator({ ...registration, ageConfirmed: false }, context, ports);

    expect(result).toMatchObject({ ok: false });
    expect(audit).toEqual([]);
  });

  it("registers a creator without a referral", async () => {
    const { ports, audit, saved } = createPorts();
    const result = await registerCreator(registration, context, ports);

    expect(result).toEqual({
      ok: true,
      creatorId: "creator-new",
      created: true,
      referral: { status: "none" },
    });
    expect(saved).toEqual([]);
    expect(audit).toEqual(["creator.registration.accepted"]);
  });

  it("attributes a valid referral after registration", async () => {
    const { ports, audit, saved } = createPorts();
    const result = await registerCreator({ ...registration, referralCode: "ABC123" }, context, ports);

    expect(result).toEqual({
      ok: true,
      creatorId: "creator-new",
      created: true,
      referral: { status: "attributed", reviewRequired: false },
    });
    expect(saved).toHaveLength(1);
    const attribution = saved[0];
    expect(attribution).toBeDefined();
    if (!attribution) throw new Error("expected saved attribution");
    expect(attribution).toMatchObject({
      workspaceId: "gmvgang",
      referralCode: "ABC123",
      referrerCreatorId: "creator-referrer",
      referredCreatorId: "creator-new",
      milestone: "registered",
    });
    expect(audit).toEqual(["creator.registration.accepted", "creator.referral.attributed"]);
  });

  it("keeps a shared-device referral but requires manual review", async () => {
    const { ports, saved } = createPorts({
      referrer: { creatorId: "creator-referrer", deviceKey: "device-new" },
    });
    const result = await registerCreator({ ...registration, referralCode: "ABC123" }, context, ports);

    expect(result).toMatchObject({
      ok: true,
      referral: { status: "attributed", reviewRequired: true },
    });
    const attribution = saved[0];
    expect(attribution).toBeDefined();
    if (!attribution) throw new Error("expected reviewed attribution");
    expect(attribution.reviewRequired).toBe(true);
    expect(attribution.riskFlags).toContain("shared_device");
  });

  it("blocks self-referral without blocking the creator account", async () => {
    const { ports, saved } = createPorts({
      creatorId: "same-creator",
      referrer: { creatorId: "same-creator" },
    });
    const result = await registerCreator({ ...registration, referralCode: "ABC123" }, context, ports);

    expect(result).toMatchObject({
      ok: true,
      creatorId: "same-creator",
      referral: { status: "rejected", reason: "self_referral" },
    });
    expect(saved).toEqual([]);
  });

  it("does not invent attribution for an unknown referral code", async () => {
    const { ports, saved } = createPorts({ referrer: null });
    const result = await registerCreator({ ...registration, referralCode: "ABC123" }, context, ports);

    expect(result).toMatchObject({
      ok: true,
      referral: { status: "rejected", reason: "referral_code_not_found" },
    });
    expect(saved).toEqual([]);
  });
});
