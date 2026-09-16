import { describe, expect, it } from "vitest";

import {
  accessibleWorkspacesForUser,
  loadPlatformSessionContext,
  type Membership,
  type Organization,
  type PlatformIdentityPort,
  type PlatformSessionPersistencePort,
  type PlatformUser,
} from "../src/index.js";

const NOW = "2026-09-16T03:10:00.000Z";
const EXPIRY = "2026-09-16T04:10:00.000Z";

const user: PlatformUser = {
  id: "user_1",
  email: "founder@example.com",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};

const organizations: Organization[] = [
  {
    id: "org_brand_b",
    type: "brand",
    name: "Beta Brand",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "org_inactive",
    type: "brand",
    name: "Inactive Brand",
    status: "inactive",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "org_gmvgang",
    type: "gmvgang",
    name: "GMVGANG",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "org_brand_a",
    type: "brand",
    name: "Alpha Brand",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const memberships: Membership[] = [
  {
    id: "m_founder",
    userId: user.id,
    organizationId: "org_gmvgang",
    role: "founder",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_admin",
    userId: user.id,
    organizationId: "org_gmvgang",
    role: "admin",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_brand_a",
    userId: user.id,
    organizationId: "org_brand_a",
    role: "brand_member",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_brand_b_revoked",
    userId: user.id,
    organizationId: "org_brand_b",
    role: "brand_member",
    status: "revoked",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_inactive_org",
    userId: user.id,
    organizationId: "org_inactive",
    role: "brand_member",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_other_user",
    userId: "user_2",
    organizationId: "org_brand_b",
    role: "brand_member",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe("platform workspaces", () => {
  it("returns only active user workspaces with tenant-local roles", () => {
    expect(accessibleWorkspacesForUser(user.id, memberships, organizations)).toEqual([
      {
        organizationId: "org_gmvgang",
        organizationType: "gmvgang",
        name: "GMVGANG",
        roles: ["founder", "admin"],
      },
      {
        organizationId: "org_brand_a",
        organizationType: "brand",
        name: "Alpha Brand",
        roles: ["brand_member"],
      },
    ]);
  });

  it("loads session and accessible workspaces from one verified server context", async () => {
    const identity: PlatformIdentityPort = {
      async verifyIdentity() {
        return {
          userId: user.id,
          emailVerified: true,
          expiresAt: EXPIRY,
        };
      },
    };

    const persistence: PlatformSessionPersistencePort = {
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

    await expect(
      loadPlatformSessionContext({
        identity,
        persistence,
        requestedOrganizationId: "org_brand_a",
        now: NOW,
      }),
    ).resolves.toEqual({
      session: {
        status: "authenticated",
        userId: user.id,
        organizationId: "org_brand_a",
        roles: ["brand_member"],
      },
      workspaces: [
        {
          organizationId: "org_gmvgang",
          organizationType: "gmvgang",
          name: "GMVGANG",
          roles: ["founder", "admin"],
        },
        {
          organizationId: "org_brand_a",
          organizationType: "brand",
          name: "Alpha Brand",
          roles: ["brand_member"],
        },
      ],
    });
  });
});
