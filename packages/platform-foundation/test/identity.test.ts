import { describe, expect, it } from "vitest";

import { activeRolesForUser, assertOrganizationAccess, type Membership, type Organization } from "../src/index.js";

const NOW = "2026-09-16T00:45:00.000Z";
const organization: Organization = {
  id: "org_brand_1",
  type: "brand",
  name: "Brand One",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
};

const memberships: Membership[] = [
  {
    id: "m_1",
    userId: "user_1",
    organizationId: organization.id,
    role: "brand_member",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "m_2",
    userId: "user_2",
    organizationId: organization.id,
    role: "brand_member",
    status: "revoked",
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe("organization membership access", () => {
  it("grants roles only from active memberships", () => {
    expect(activeRolesForUser("user_1", organization.id, memberships)).toEqual(["brand_member"]);
    expect(activeRolesForUser("user_2", organization.id, memberships)).toEqual([]);
  });

  it("denies organization access without an active membership", () => {
    expect(() => assertOrganizationAccess("user_1", organization, memberships)).not.toThrow();
    expect(() => assertOrganizationAccess("user_2", organization, memberships)).toThrow("ORGANIZATION_ACCESS_DENIED");
  });
});
