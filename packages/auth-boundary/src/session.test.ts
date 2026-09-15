import { describe, expect, it } from "vitest";
import { resolvePlatformSession, type AuthIdentityProvider, type MembershipRepository } from "./session";

const identityProvider: AuthIdentityProvider = {
  async verifySessionCredential(credential) {
    if (credential === "bad") return null;
    return { provider: "test-auth", subject: "subject-1", emailVerified: credential !== "unverified" };
  },
};

const memberships: MembershipRepository = {
  async findMembership({ workspaceId }) {
    return {
      principalId: "principal-1",
      workspaceId,
      role: "creator",
      brandIds: [],
      creatorId: "creator-1",
    };
  },
};

describe("platform session boundary", () => {
  it("rejects missing and invalid credentials", async () => {
    expect(await resolvePlatformSession({ workspaceId: "gmvgang", identityProvider, memberships })).toEqual({ ok: false, reason: "missing_credential" });
    expect(await resolvePlatformSession({ workspaceId: "gmvgang", sessionCredential: "bad", identityProvider, memberships })).toEqual({ ok: false, reason: "invalid_session" });
  });

  it("requires verified email by default", async () => {
    expect(await resolvePlatformSession({ workspaceId: "gmvgang", sessionCredential: "unverified", identityProvider, memberships })).toEqual({ ok: false, reason: "email_unverified" });
  });

  it("returns a tenant-scoped platform membership", async () => {
    const result = await resolvePlatformSession({ workspaceId: "gmvgang", sessionCredential: "good", identityProvider, memberships });
    expect(result).toMatchObject({ ok: true, membership: { workspaceId: "gmvgang", role: "creator", creatorId: "creator-1" } });
  });

  it("blocks memberships returned for another workspace", async () => {
    const wrongWorkspace: MembershipRepository = {
      async findMembership() {
        return { principalId: "principal-1", workspaceId: "other", role: "agency_admin", brandIds: [] };
      },
    };
    expect(await resolvePlatformSession({ workspaceId: "gmvgang", sessionCredential: "good", identityProvider, memberships: wrongWorkspace })).toEqual({ ok: false, reason: "membership_not_found" });
  });
});
