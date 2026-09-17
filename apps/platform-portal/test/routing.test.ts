import { describe, expect, it } from "vitest";

import {
  canAccessArea,
  canAccessRoute,
  defaultAreaForSession,
  moduleRoutesForArea,
  PRIMARY_PORTAL_ROUTES,
  resolvePortalRoute,
} from "../src/routing.js";
import type { PortalSession } from "../src/session.js";

const creator: PortalSession = {
  status: "authenticated",
  userId: "creator-1",
  organizationId: "creator-org-1",
  roles: ["creator"],
};
const brand: PortalSession = {
  status: "authenticated",
  userId: "brand-1",
  organizationId: "org-1",
  roles: ["brand_member"],
};
const team: PortalSession = {
  status: "authenticated",
  userId: "team-1",
  organizationId: "gmvgang-org",
  roles: ["creator_manager"],
};
const anonymous: PortalSession = { status: "anonymous", roles: [] };

describe("platform portal routing", () => {
  it("resolves area roots, public auth routes, nested modules and trailing slashes", () => {
    expect(resolvePortalRoute("/login")).toMatchObject({ area: "public", path: "/login" });
    expect(resolvePortalRoute("/account/password")).toMatchObject({
      area: "public",
      path: "/account/password",
      navigation: "hidden",
    });
    expect(resolvePortalRoute("/creator/")).toMatchObject({ area: "creator", moduleId: "overview" });
    expect(resolvePortalRoute("/creator/referrals/")).toMatchObject({
      area: "creator",
      moduleId: "referrals",
      label: "Referral Hub",
    });
    expect(resolvePortalRoute("brand/profitability")).toMatchObject({
      area: "brand",
      moduleId: "profitability",
    });
    expect(resolvePortalRoute("/team/activity")).toMatchObject({ area: "team", moduleId: "activity" });
    expect(resolvePortalRoute("/team/admin")).toMatchObject({
      area: "team",
      moduleId: "admin",
      requiredCapability: "users.manage",
    });
  });

  it("does not infer protected access from unknown path prefixes", () => {
    expect(resolvePortalRoute("/brand/unknown").area).toBe("public");
    expect(resolvePortalRoute("/brand-malicious").area).toBe("public");
    expect(resolvePortalRoute("/creatorish").area).toBe("public");
  });

  it("keeps the global navigation limited to top-level surfaces", () => {
    expect(PRIMARY_PORTAL_ROUTES.map((route) => route.path)).toEqual([
      "/",
      "/join",
      "/login",
      "/creator",
      "/brand",
      "/team",
    ]);
  });

  it("returns only module navigation for the requested protected area", () => {
    expect(moduleRoutesForArea("brand").map((route) => route.path)).toEqual([
      "/brand/profitability",
      "/brand/actions",
      "/brand/campaigns",
      "/brand/creators",
      "/brand/approvals",
      "/brand/reporting",
    ]);
    expect(moduleRoutesForArea("brand").every((route) => route.area === "brand")).toBe(true);
  });

  it("keeps creator, brand and team areas isolated", () => {
    expect(canAccessArea(creator, "creator")).toBe(true);
    expect(canAccessArea(creator, "brand")).toBe(false);
    expect(canAccessArea(brand, "brand")).toBe(true);
    expect(canAccessArea(brand, "team")).toBe(false);
    expect(canAccessArea(team, "team")).toBe(true);
    expect(canAccessArea(team, "creator")).toBe(false);
  });

  it("gates privileged module routes beyond the team-area boundary", () => {
    const founder: PortalSession = {
      status: "authenticated",
      userId: "founder-1",
      organizationId: "gmvgang-org",
      roles: ["founder"],
    };
    const adminRoute = resolvePortalRoute("/team/admin");
    expect(canAccessArea(team, "team")).toBe(true);
    expect(canAccessRoute(team, adminRoute)).toBe(false);
    expect(canAccessRoute(founder, adminRoute)).toBe(true);
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
