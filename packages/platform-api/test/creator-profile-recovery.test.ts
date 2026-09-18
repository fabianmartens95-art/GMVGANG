import { describe, expect, it } from "vitest";
import type {
  CreatorRegistrationAuditSink,
  CreatorRegistrationPorts,
} from "@gmvgang/creator-registration";
import type { CreatorProfile } from "@gmvgang/platform-foundation";

import {
  completeCreatorProfileWithRecovery,
  reconcileCreatorOperationsLink,
} from "../src/index.js";

const NOW = "2026-09-18T00:00:00.000Z";

function profile(status: CreatorProfile["networkStatus"] = "registered"): CreatorProfile {
  return {
    id: "creator-1",
    userId: "user-1",
    tiktokHandle: "creator.one",
    displayName: "Creator One",
    market: "DE",
    language: "de",
    niche: ["beauty"],
    networkStatus: status,
    profileCompletionPercent: status === "profile_complete" ? 100 : 20,
    referralCode: "GMVABC123",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function portsWithTransientAuditFailure() {
  let stored = profile();
  let auditAttempts = 0;
  const auditEvents: Array<Parameters<CreatorRegistrationAuditSink["record"]>[0]> = [];

  const ports: CreatorRegistrationPorts = {
    profiles: {
      async findByUserId(userId) { return stored.userId === userId ? stored : null; },
      async findByTikTokHandle(handle) { return stored.tiktokHandle === handle ? stored : null; },
      async findByReferralCode() { return null; },
      async createProfile(value) { stored = value; },
      async updateProfile(value) { stored = value; },
    },
    referrals: {
      async findByReferredCreatorProfileId() { return null; },
      async save() {},
      async update() {},
    },
    consents: { async record() {} },
    ids: {
      nextCreatorProfileId() { return "creator-2"; },
      nextReferralAttributionId() { return "referral-1"; },
      nextReferralCodeCandidate() { return "GMVABC999"; },
    },
    audit: {
      async record(input) {
        auditAttempts += 1;
        if (auditAttempts === 1) throw new Error("AUDIT_INSERT_FAILED:08006");
        auditEvents.push(input);
      },
    },
  };

  return {
    ports,
    stored: () => stored,
    auditAttempts: () => auditAttempts,
    auditEvents,
  };
}

describe("Creator profile production recovery", () => {
  it("retries inside the same request when a downstream failure happens after the profile was durably completed", async () => {
    const h = portsWithTransientAuditFailure();

    const completed = await completeCreatorProfileWithRecovery(
      {
        tiktokHandle: "@creator.one",
        displayName: "Creator One",
        market: "DE",
        language: "de",
        niche: ["beauty"],
      },
      { userId: "user-1", now: NOW },
      h.ports,
    );

    expect(completed.networkStatus).toBe("profile_complete");
    expect(completed.profileCompletionPercent).toBe(100);
    expect(h.stored().networkStatus).toBe("profile_complete");
    expect(h.auditAttempts()).toBe(2);
    expect(h.auditEvents).toHaveLength(1);
  });

  it("does not mask a failure that happened before durable profile completion", async () => {
    const h = portsWithTransientAuditFailure();
    h.ports.profiles.updateProfile = async () => {
      throw new Error("CREATOR_PROFILE_UPDATE_FAILED:08006");
    };

    await expect(completeCreatorProfileWithRecovery(
      {
        tiktokHandle: "@creator.one",
        displayName: "Creator One",
        market: "DE",
        language: "de",
        niche: ["beauty"],
      },
      { userId: "user-1", now: NOW },
      h.ports,
    )).rejects.toThrow("CREATOR_PROFILE_UPDATE_FAILED");
    expect(h.stored().networkStatus).toBe("registered");
  });

  it("repairs a missing Company OS link only for a completed unlinked Creator", async () => {
    let syncCalls = 0;
    const repaired = await reconcileCreatorOperationsLink(profile("profile_complete"), NOW, async (value) => {
      syncCalls += 1;
      return { ...value, creatorMasterId: "notion-page-1" };
    });

    expect(syncCalls).toBe(1);
    expect(repaired.creatorMasterId).toBe("notion-page-1");

    await reconcileCreatorOperationsLink(repaired, NOW, async (value) => {
      syncCalls += 1;
      return value;
    });
    expect(syncCalls).toBe(1);
  });
});
