import assert from "node:assert/strict";
import test from "node:test";

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

test("only active memberships grant organization roles", () => {
  assert.deepEqual(activeRolesForUser("user_1", organization.id, memberships), ["brand_member"]);
  assert.deepEqual(activeRolesForUser("user_2", organization.id, memberships), []);
});

test("organization access is denied without an active membership", () => {
  assert.doesNotThrow(() => assertOrganizationAccess("user_1", organization, memberships));
  assert.throws(() => assertOrganizationAccess("user_2", organization, memberships), /ORGANIZATION_ACCESS_DENIED/);
});
