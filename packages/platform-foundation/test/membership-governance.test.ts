import { describe, expect, it } from "vitest";

import { authorizeMembershipMutation } from "../src/index.js";

describe("membership governance", () => {
  it("allows a founder to manage an admin in the GMVGANG organization", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["founder"],
      targetRole: "admin",
      organizationType: "gmvgang",
    })).toEqual({ ok: true });
  });

  it("prevents admins from creating or managing other admins", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["admin"],
      targetRole: "admin",
      organizationType: "gmvgang",
    })).toEqual({ ok: false, error: "ADMIN_ROLE_REQUIRES_FOUNDER" });
  });

  it("keeps founder membership bootstrap-only", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["founder"],
      targetRole: "founder",
      organizationType: "gmvgang",
    })).toEqual({ ok: false, error: "FOUNDER_ROLE_PROTECTED" });
  });

  it("allows operational team roles only in the GMVGANG organization", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["admin"],
      targetRole: "creator_manager",
      organizationType: "gmvgang",
    })).toEqual({ ok: true });

    expect(authorizeMembershipMutation({
      actorRoles: ["admin"],
      targetRole: "creator_manager",
      organizationType: "brand",
    })).toEqual({ ok: false, error: "MEMBERSHIP_ROLE_SCOPE_MISMATCH" });
  });

  it("allows brand members only in brand organizations", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["admin"],
      targetRole: "brand_member",
      organizationType: "brand",
    })).toEqual({ ok: true });

    expect(authorizeMembershipMutation({
      actorRoles: ["admin"],
      targetRole: "brand_member",
      organizationType: "gmvgang",
    })).toEqual({ ok: false, error: "MEMBERSHIP_ROLE_SCOPE_MISMATCH" });
  });

  it("denies membership mutations to roles without users.manage", () => {
    expect(authorizeMembershipMutation({
      actorRoles: ["creator"],
      targetRole: "brand_member",
      organizationType: "brand",
    })).toEqual({ ok: false, error: "MEMBERSHIP_MANAGEMENT_DENIED" });
  });
});
