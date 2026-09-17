import { describe, expect, it } from "vitest";

import { resolvePlatformSession, type Membership, type Organization, type PlatformUser } from "../src/index.js";

const user: PlatformUser = {
  id: "user-1",
  email: "member@example.com",
  status: "active",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const brand: Organization = {
  id: "brand-1",
  type: "brand",
  name: "Brand One",
  status: "active",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const secondBrand: Organization = {
  ...brand,
  id: "brand-2",
  name: "Brand Two",
};

function membership(organizationId: string, role: Membership["role"] = "brand_member"): Membership {
  return {
    id: `membership-${organizationId}-${role}`,
    userId: user.id,
    organizationId,
    role,
    status: "active",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const identity = {
  userId: user.id,
  emailVerified: true,
  expiresAt: "2026-09-17T00:00:00.000Z",
};

const now = "2026-09-16T00:00:00.000Z";

describe("resolvePlatformSession", () => {
  it("stays anonymous without a verified provider identity", () => {
    expect(
      resolvePlatformSession({
        memberships: [],
        organizations: [],
        now,
      }),
    ).toEqual({ status: "anonymous", roles: [] });
  });

  it("fails closed for unverified email, expired sessions and inactive accounts", () => {
    expect(() =>
      resolvePlatformSession({
        identity: { ...identity, emailVerified: false },
        user,
        memberships: [],
        organizations: [],
        now,
      }),
    ).toThrow("SESSION_EMAIL_NOT_VERIFIED");

    expect(() =>
      resolvePlatformSession({
        identity: { ...identity, expiresAt: now },
        user,
        memberships: [],
        organizations: [],
        now,
      }),
    ).toThrow("SESSION_EXPIRED");

    expect(() =>
      resolvePlatformSession({
        identity,
        user: { ...user, status: "suspended" },
        memberships: [],
        organizations: [],
        now,
      }),
    ).toThrow("ACCOUNT_ACCESS_DENIED");
  });

  it("binds a requested tenant only when an active membership exists", () => {
    expect(
      resolvePlatformSession({
        identity,
        user,
        memberships: [membership(brand.id)],
        organizations: [brand],
        requestedOrganizationId: brand.id,
        now,
      }),
    ).toEqual({
      status: "authenticated",
      userId: user.id,
      email: user.email,
      organizationId: brand.id,
      roles: ["brand_member"],
    });

    expect(() =>
      resolvePlatformSession({
        identity,
        user,
        memberships: [membership(brand.id)],
        organizations: [brand, secondBrand],
        requestedOrganizationId: secondBrand.id,
        now,
      }),
    ).toThrow("ORGANIZATION_ACCESS_DENIED");
  });

  it("automatically selects a single active tenant", () => {
    expect(
      resolvePlatformSession({
        identity,
        user,
        memberships: [membership(brand.id), membership(brand.id, "brand_manager")],
        organizations: [brand],
        now,
      }),
    ).toEqual({
      status: "authenticated",
      userId: user.id,
      email: user.email,
      organizationId: brand.id,
      roles: ["brand_member", "brand_manager"],
    });
  });

  it("does not merge roles across tenants when tenant selection is ambiguous", () => {
    expect(
      resolvePlatformSession({
        identity,
        user,
        memberships: [membership(brand.id), membership(secondBrand.id)],
        organizations: [brand, secondBrand],
        now,
      }),
    ).toEqual({
      status: "authenticated",
      userId: user.id,
      email: user.email,
      roles: [],
    });
  });

  it("keeps authenticated accounts without membership usable for onboarding but grants no portal role", () => {
    expect(
      resolvePlatformSession({
        identity,
        user,
        memberships: [],
        organizations: [],
        now,
      }),
    ).toEqual({
      status: "authenticated",
      userId: user.id,
      email: user.email,
      roles: [],
    });
  });
});
