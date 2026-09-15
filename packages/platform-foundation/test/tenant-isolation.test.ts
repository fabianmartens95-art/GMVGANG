import assert from "node:assert/strict";
import test from "node:test";

import { anyRoleHasCapability, roleHasCapability } from "../src/index.js";

test("external creator and brand roles do not receive internal cross-tenant capabilities", () => {
  for (const role of ["creator", "brand_member"] as const) {
    assert.equal(roleHasCapability(role, "users.manage"), false);
    assert.equal(roleHasCapability(role, "creators.read_all"), false);
    assert.equal(roleHasCapability(role, "brands.read_all"), false);
    assert.equal(roleHasCapability(role, "campaigns.read_all"), false);
  }
});

test("founder role carries platform management while operational roles do not", () => {
  assert.equal(roleHasCapability("founder", "platform.manage"), true);
  assert.equal(anyRoleHasCapability(["closer", "creator_manager", "brand_manager"], "platform.manage"), false);
});
