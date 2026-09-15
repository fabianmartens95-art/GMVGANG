import { describe, expect, it } from "vitest";
import { canAccess, type PlatformMembership } from "./access";

const workspaceId = "gmvgang";

function membership(overrides: Partial<PlatformMembership>): PlatformMembership {
  return {
    principalId: "user-1",
    workspaceId,
    role: "agency_operator",
    brandIds: ["brand-a"],
    ...overrides,
  };
}

describe("access control", () => {
  it("allows agency admins across brands inside the workspace", () => {
    expect(
      canAccess(
        membership({ role: "agency_admin", brandIds: [] }),
        "analytics.read",
        { workspaceId, brandId: "brand-b" },
      ),
    ).toBe(true);
  });

  it("prevents cross-workspace access", () => {
    expect(
      canAccess(
        membership({ role: "agency_owner" }),
        "brands.read",
        { workspaceId: "other-workspace", brandId: "brand-a" },
      ),
    ).toBe(false);
  });

  it("limits agency operators to assigned brands", () => {
    const actor = membership({ role: "agency_operator", brandIds: ["brand-a"] });

    expect(canAccess(actor, "campaigns.write", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "campaigns.write", { workspaceId, brandId: "brand-b" })).toBe(false);
  });

  it("gives closers sales access but not creator operations access", () => {
    const actor = membership({ role: "closer", brandIds: ["brand-a"] });

    expect(canAccess(actor, "pipeline.write", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "samples.write", { workspaceId, brandId: "brand-a" })).toBe(false);
  });

  it("gives creator managers creator operations access for assigned brands", () => {
    const actor = membership({ role: "creator_manager", brandIds: ["brand-a"] });

    expect(canAccess(actor, "creators.write", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "outreach.write", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "brands.write", { workspaceId, brandId: "brand-a" })).toBe(false);
  });

  it("gives brand managers brand operations access without user administration", () => {
    const actor = membership({ role: "brand_manager", brandIds: ["brand-a"] });

    expect(canAccess(actor, "campaigns.write", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "users.manage", { workspaceId, brandId: "brand-a" })).toBe(false);
  });

  it("keeps external contractors deny-by-default except explicit grants", () => {
    const actor = membership({
      role: "external_contractor",
      brandIds: ["brand-a"],
      grantedPermissions: ["reports.read"],
    });

    expect(canAccess(actor, "reports.read", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "analytics.read", { workspaceId, brandId: "brand-a" })).toBe(false);
  });

  it("supports explicit permission revocation", () => {
    const actor = membership({
      role: "brand_manager",
      brandIds: ["brand-a"],
      revokedPermissions: ["reports.share"],
    });

    expect(canAccess(actor, "reports.share", { workspaceId, brandId: "brand-a" })).toBe(false);
  });

  it("limits brand users to their brands", () => {
    const actor = membership({ role: "brand_admin", brandIds: ["brand-a"] });

    expect(canAccess(actor, "reports.read", { workspaceId, brandId: "brand-a" })).toBe(true);
    expect(canAccess(actor, "reports.read", { workspaceId, brandId: "brand-b" })).toBe(false);
  });

  it("limits creators to their own creator-scoped resources", () => {
    const actor = membership({ role: "creator", brandIds: [], creatorId: "creator-1" });

    expect(
      canAccess(actor, "profile.write", { workspaceId, creatorId: "creator-1" }),
    ).toBe(true);
    expect(
      canAccess(actor, "profile.write", { workspaceId, creatorId: "creator-2" }),
    ).toBe(false);
  });

  it("does not grant creators agency permissions", () => {
    const actor = membership({ role: "creator", brandIds: [], creatorId: "creator-1" });

    expect(
      canAccess(actor, "users.manage", { workspaceId, creatorId: "creator-1" }),
    ).toBe(false);
  });
});
