import { describe, expect, it } from "vitest";

import { canAccessArea, defaultAreaForSession, resolvePortalRoute } from "../src/routing.js";
import type { PortalSession } from "../src/session.js";

const creator: PortalSession = { status: "authenticated", userId: "creator-1", roles: ["creator"] };
const brand: PortalSession = {
  status: "authenticated",
  userId: "brand-1",
  organizationId: "org-1",
  roles: ["brand_member"],
};
const team: PortalSession = { status: "authenticated", userId: "team-1", roles: ["creator_manager"] };
const anonymous: PortalSession = { status: "anonymous", roles: [] };

describe("platform portal routing", () => {
  it("resolves known areas and falls back to public", () => {
    expect(resolvePortalRoute("/creator/").area).toBe("creator");
    expect(resolvePortalRoute("/unknown").area).toBe("public");
  });

  it("keeps creator, brand and team areas isolated", () => {
    expect(canAccessArea(creator, "creator")).toBe(true);
    expect(canAccessArea(creator, "brand")).toBe(false);
    expect(canAccessArea(brand, "brand")).toBe(true);
    expect(canAccessArea(brand, "team")).toBe(false);
    expect(canAccessArea(team, "team")).toBe(true);
    expect(canAccessArea(team, "creator")).toBe(false);
  });

  it("denies protected areas to anonymous sessions", () => {
    expect(canAccessArea(anonymous, "creator")).toBe(false);
    expect(canAccessArea(anonymous, "brand")).toBe(false);
    expect(canAccessArea(anonymous, "team")).toBe(false);
  });

  it("chooses a role-safe default area", () => {
    expect(defaultAreaForSession(creator)).toBe("creator");
    expect(defaultAreaForSession(brand)).toBe("brand");
    expect(defaultAreaForSession(team)).toBe("team");
    expect(defaultAreaForSession(anonymous)).toBe("public");
  });
});
