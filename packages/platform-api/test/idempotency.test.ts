import { describe, expect, it } from "vitest";
import type { CreatorProfile } from "@gmvgang/platform-foundation";

import {
  createPlatformApiHandler,
  type PlatformApiDependencies,
  type PlatformIdempotencyBeginResult,
  type PlatformIdempotencyPort,
} from "../src/index.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-16T20:00:00.000Z";

const profile: CreatorProfile = {
  id: "creator-1",
  userId: "user-1",
  tiktokHandle: "creator.one",
  networkStatus: "registered",
  profileCompletionPercent: 20,
  referralCode: "GMVABC123",
  createdAt: NOW,
  updatedAt: NOW,
};

class MemoryIdempotency implements PlatformIdempotencyPort {
  private readonly records = new Map<string, {
    requestHash: string;
    state: "pending" | "completed";
    responseStatus?: number;
    responseBody?: unknown;
  }>();

  async begin(input: {
    scope: "creator_registration" | "creator_profile_completion";
    subject: string;
    key: string;
    requestHash: string;
    now: string;
  }): Promise<PlatformIdempotencyBeginResult> {
    const composite = `${input.scope}:${input.subject}:${input.key}`;
    const existing = this.records.get(composite);
    if (!existing) {
      this.records.set(composite, { requestHash: input.requestHash, state: "pending" });
      return { status: "started" };
    }
    if (existing.requestHash !== input.requestHash) return { status: "conflict" };
    if (existing.state !== "completed") return { status: "in_progress" };
    return {
      status: "replay",
      responseStatus: existing.responseStatus ?? 500,
      responseBody: existing.responseBody,
    };
  }

  async complete(input: {
    scope: "creator_registration" | "creator_profile_completion";
    subject: string;
    key: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    now: string;
  }): Promise<void> {
    this.records.set(`${input.scope}:${input.subject}:${input.key}`, {
      requestHash: input.requestHash,
      state: "completed",
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
    });
  }
}

function setup() {
  let writes = 0;
  const idempotency = new MemoryIdempotency();
  const dependencies: PlatformApiDependencies = {
    accessTokens: { async getAccessToken() { return "access-token"; } },
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-16",
    idempotency,
    services: {
      async resolveSessionContext() {
        return {
          session: { status: "authenticated", userId: "user-1", roles: [] },
          workspaces: [],
        };
      },
      async getCreatorProfile() { return profile; },
      async registerCreator() {
        writes += 1;
        return { ok: true, created: true, creatorProfile: profile, referral: { status: "none" } };
      },
      async completeCreatorProfile() { return profile; },
    },
  };

  return {
    handler: createPlatformApiHandler(dependencies),
    writes: () => writes,
  };
}

function registration(handle: string, key = "creator-registration-0001") {
  return new Request(`${ORIGIN}/api/creator/registration`, {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      tiktokHandle: handle,
      ageConfirmed: true,
      privacyAccepted: true,
      privacyNoticeVersion: "2026-09-16",
    }),
  });
}

describe("critical mutation idempotency", () => {
  it("replays an identical completed request without a second domain write", async () => {
    const { handler, writes } = setup();
    const first = await handler(registration("@creator.one"));
    const replay = await handler(registration("@creator.one"));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true");
    expect(writes()).toBe(1);
    expect(await replay.json()).toEqual(await first.json());
  });

  it("rejects reuse of the same key for a different payload", async () => {
    const { handler, writes } = setup();
    expect((await handler(registration("@creator.one"))).status).toBe(200);

    const conflict = await handler(registration("@creator.two"));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ ok: false, errors: ["idempotency_key_conflict"] });
    expect(writes()).toBe(1);
  });
});
