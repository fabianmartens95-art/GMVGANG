import { describe, expect, it } from "vitest";

import { anyRoleHasCapability, roleHasCapability } from "../src/index.js";

describe("tenant isolation defaults", () => {
  it("keeps external creator and brand roles away from internal cross-tenant capabilities", () => {
    for (const role of ["creator", "brand_member"] as const) {
      expect(roleHasCapability(role, "users.manage")).toBe(false);
      expect(roleHasCapability(role, "creators.read_all")).toBe(false);
      expect(roleHasCapability(role, "brands.read_all")).toBe(false);
      expect(roleHasCapability(role, "campaigns.read_all")).toBe(false);
      expect(roleHasCapability(role, "team.workspace.read")).toBe(false);
    }
  });

  it("separates Creator Portal and Brand Portal access", () => {
    expect(roleHasCapability("creator", "creator.portal.access")).toBe(true);
    expect(roleHasCapability("creator", "brand.portal.access")).toBe(false);
    expect(roleHasCapability("brand_member", "brand.portal.access")).toBe(true);
    expect(roleHasCapability("brand_member", "creator.portal.access")).toBe(false);
  });

  it("grants Team Workspace access only to internal roles", () => {
    expect(anyRoleHasCapability(["founder"], "team.workspace.read")).toBe(true);
    expect(anyRoleHasCapability(["admin", "creator_manager", "brand_manager", "closer"], "team.workspace.read")).toBe(true);
    expect(anyRoleHasCapability(["creator", "brand_member"], "team.workspace.read")).toBe(false);
  });

  it("reserves platform management for the founder role", () => {
    expect(roleHasCapability("founder", "platform.manage")).toBe(true);
    expect(anyRoleHasCapability(["closer", "creator_manager", "brand_manager"], "platform.manage")).toBe(false);
  });
});
