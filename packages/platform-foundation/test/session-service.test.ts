import { describe, expect, it } from "vitest";

import {
  loadPlatformSession,
  type Membership,
  type Organization,
  type PlatformIdentityPort,
  type PlatformSessionPersistencePort,
  type PlatformUser,
  type VerifiedPlatformIdentity,
} from "../src/index.js";

const NOW = "2026-09-16T02:55:00.000Z";
const EXPIRY = "2026-09-16T03:55:00.000Z";

const identity: VerifiedPlatformIdentity = {
  userId: "user_1",
  emailVerified: true,
  expiresAt: EXPIRY,
};

const user: PlatformUser = {
  id: "user_1",
  email: "user@example.com",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};

const organizations: Organization[] = [
  {
    id: "org_gmvgang",
    type: "gmvgang",
    name: "GMVGANG",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "org_brand",
    type: "brand",
    name: "Brand GmbH",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const memberships: Membership[] = [
  {
    id: "membership_founder",
    userId: user.id,
    organizationId: "org_gmvgang",
    role: "founder",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "membership_brand",
    userId: user.id,
    organizationId: "org_brand",
    role: "brand_member",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

function identityPort(value: VerifiedPlatformIdentity | null = identity): PlatformIdentityPort {
  return {
    async verifyIdentity() {
      return value;
    },
  };
}

function persistencePort(): PlatformSessionPersistencePort {
  return {
    async findUserById(userId) {
      return userId === user.id ? user : null;
    },
    async listMembershipsForUser(userId) {
      return memberships.filter((membership) => membership.userId === userId);
    },
    async listOrganizationsByIds(organizationIds) {
      return organizations.filter((organization) => organizationIds.includes(organization.id));
    },
  };
}

describe("platform session service", () => {
  it("returns anonymous without touching persistence when no identity is verified", async () => {
    let persistenceCalls = 0;
    const persistence: PlatformSessionPersistencePort = {
      async findUserById() {
        persistenceCalls += 1;
        return null;
      },
      async listMembershipsForUser() {
        persistenceCalls += 1;
        return [];
      },
      async listOrganizationsByIds() {
        persistenceCalls += 1;
        return [];
      },
    };

    await expect(
      loadPlatformSession({ identity: identityPort(null), persistence, now: NOW }),
    ).resolves.toEqual({ status: "anonymous", roles: [] });
    expect(persistenceCalls).toBe(0);
  });

  it("does not merge roles across organizations without an explicit tenant", async () => {
    await expect(
      loadPlatformSession({ identity: identityPort(), persistence: persistencePort(), now: NOW }),
    ).resolves.toEqual({ status: "authenticated", userId: user.id, roles: [] });
  });

  it("resolves only the roles belonging to the requested organization", async () => {
    await expect(
      loadPlatformSession({
        identity: identityPort(),
        persistence: persistencePort(),
        requestedOrganizationId: "org_brand",
        now: NOW,
      }),
    ).resolves.toEqual({
      status: "authenticated",
      userId: user.id,
      organizationId: "org_brand",
      roles: ["brand_member"],
    });
  });

  it("fails closed when persistence cannot resolve the verified platform user", async () => {
    const persistence = persistencePort();
    persistence.findUserById = async () => null;

    await expect(
      loadPlatformSession({ identity: identityPort(), persistence, now: NOW }),
    ).rejects.toThrow("ACCOUNT_ACCESS_DENIED");
  });

  it("fails closed for an organization outside the verified user's memberships", async () => {
    await expect(
      loadPlatformSession({
        identity: identityPort(),
        persistence: persistencePort(),
        requestedOrganizationId: "org_unknown",
        now: NOW,
      }),
    ).rejects.toThrow("ORGANIZATION_ACCESS_DENIED");
  });
});
