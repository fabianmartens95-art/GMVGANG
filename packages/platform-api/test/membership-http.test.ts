import { describe, expect, it } from "vitest";
import type { CreatorProfile, Membership } from "@gmvgang/platform-foundation";

import { createPlatformApiHandler, type PlatformApiDependencies, type PlatformApiServices } from "../src/index.js";

const NOW = "2026-09-17T00:10:00.000Z";
const ORIGIN = "https://app.gmvgang.de";
const ACTOR_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";

const creatorProfile: CreatorProfile = {
  id: "creator-profile",
  userId: ACTOR_USER_ID,
  tiktokHandle: "creator.one",
  networkStatus: "registered",
  profileCompletionPercent: 20,
  referralCode: "GMVTEST123",
  createdAt: NOW,
  updatedAt: NOW,
};

function setup(options?: { authenticated?: boolean; membershipError?: Error }) {
  const mutations: Array<Record<string, unknown>> = [];
  const membership: Membership = {
    id: "membership-1",
    userId: TARGET_USER_ID,
    organizationId: ORGANIZATION_ID,
    role: "creator_manager",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  };

  const services: PlatformApiServices = {
    async resolveSessionContext() {
      if (options?.authenticated === false) return { session: { status: "anonymous", roles: [] }, workspaces: [] };
      return {
        session: { status: "authenticated", userId: ACTOR_USER_ID, roles: [] },
        workspaces: [],
      };
    },
    async manageMembership(input) {
      mutations.push(input);
      if (options?.membershipError) throw options.membershipError;
      return { ...membership, role: input.role, status: input.status };
    },
    async getCreatorProfile() {
      return creatorProfile;
    },
    async registerCreator() {
      return { ok: true, created: true, creatorProfile, referral: { status: "none" } };
    },
    async completeCreatorProfile() {
      return creatorProfile;
    },
  };

  const dependencies: PlatformApiDependencies = {
    accessTokens: { async getAccessToken() { return "verified-access-token"; } },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-16",
  };

  return { handler: createPlatformApiHandler(dependencies), mutations };
}

function request(body: Record<string, unknown>, origin = ORIGIN): Request {
  return new Request(`${ORIGIN}/api/memberships`, {
    method: "PUT",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": origin === ORIGIN ? "same-origin" : "cross-site",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<any> {
  return response.json();
}

describe("platform membership HTTP API", () => {
  it("derives the actor from the verified server session", async () => {
    const { handler, mutations } = setup();
    const response = await handler(request({
      actorUserId: "99999999-9999-4999-8999-999999999999",
      targetUserId: TARGET_USER_ID,
      organizationId: ORGANIZATION_ID,
      role: "creator_manager",
      status: "active",
    }));

    expect(response.status).toBe(200);
    expect(mutations).toEqual([{
      actorUserId: ACTOR_USER_ID,
      targetUserId: TARGET_USER_ID,
      organizationId: ORGANIZATION_ID,
      role: "creator_manager",
      status: "active",
      now: NOW,
    }]);
    await expect(json(response)).resolves.toMatchObject({
      ok: true,
      membership: { role: "creator_manager", status: "active" },
    });
  });

  it("rejects cross-origin membership writes before authentication or persistence", async () => {
    const { handler, mutations } = setup();
    const response = await handler(request({
      targetUserId: TARGET_USER_ID,
      organizationId: ORGANIZATION_ID,
      role: "creator_manager",
      status: "active",
    }, "https://evil.example"));

    expect(response.status).toBe(403);
    expect(mutations).toEqual([]);
  });

  it("requires an authenticated server session", async () => {
    const { handler, mutations } = setup({ authenticated: false });
    const response = await handler(request({
      targetUserId: TARGET_USER_ID,
      organizationId: ORGANIZATION_ID,
      role: "creator_manager",
      status: "active",
    }));

    expect(response.status).toBe(401);
    expect(mutations).toEqual([]);
  });

  it("rejects malformed ids and role payloads", async () => {
    const { handler, mutations } = setup();
    const response = await handler(request({
      targetUserId: "not-a-uuid",
      organizationId: ORGANIZATION_ID,
      role: "super_admin",
      status: "active",
    }));

    expect(response.status).toBe(400);
    expect(mutations).toEqual([]);
  });

  it("maps privilege escalation failures to a forbidden response", async () => {
    const { handler } = setup({ membershipError: new Error("ADMIN_ROLE_REQUIRES_FOUNDER") });
    const response = await handler(request({
      targetUserId: TARGET_USER_ID,
      organizationId: ORGANIZATION_ID,
      role: "admin",
      status: "active",
    }));

    expect(response.status).toBe(403);
    await expect(json(response)).resolves.toEqual({ ok: false, error: "admin_role_requires_founder" });
  });

  it("uses PUT semantics for idempotent desired membership state", async () => {
    const { handler } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/memberships`, { method: "POST" }));

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("PUT");
  });
});
