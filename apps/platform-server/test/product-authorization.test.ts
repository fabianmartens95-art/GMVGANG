import { describe, expect, it } from "vitest";

import { hasBrandProductManageAccess } from "../src/parallel-v1.js";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

function membership(role: string, organizationId = ORG_A, status = "active") {
  return { organization_id: organizationId, role, status };
}

describe("Brand Product capability enforcement", () => {
  it("allows only roles granted the canonical products.manage capability", () => {
    for (const role of ["founder", "admin", "brand_manager", "brand_member"]) {
      expect(hasBrandProductManageAccess([membership(role)], ORG_A)).toBe(true);
    }

    for (const role of ["creator_manager", "closer", "creator"]) {
      expect(hasBrandProductManageAccess([membership(role)], ORG_A)).toBe(false);
    }
  });

  it("fails closed for cross-tenant membership even when the role can manage products", () => {
    expect(hasBrandProductManageAccess([membership("brand_member", ORG_B)], ORG_A)).toBe(false);
  });

  it("fails closed for inactive or unknown roles", () => {
    expect(hasBrandProductManageAccess([membership("brand_member", ORG_A, "revoked")], ORG_A)).toBe(false);
    expect(hasBrandProductManageAccess([membership("unexpected_role")], ORG_A)).toBe(false);
  });

  it("uses the matching organization membership when users belong to multiple workspaces", () => {
    expect(
      hasBrandProductManageAccess(
        [membership("creator", ORG_B), membership("brand_manager", ORG_A)],
        ORG_A,
      ),
    ).toBe(true);
    expect(
      hasBrandProductManageAccess(
        [membership("brand_manager", ORG_B), membership("creator", ORG_A)],
        ORG_A,
      ),
    ).toBe(false);
  });
});
