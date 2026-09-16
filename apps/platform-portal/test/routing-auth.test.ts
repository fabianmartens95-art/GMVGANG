import { describe, expect, it } from "vitest";

import { PRIMARY_PORTAL_ROUTES, resolvePortalRoute } from "../src/routing.js";

describe("portal auth routing", () => {
  it("resolves login and callback as explicit public hidden routes", () => {
    expect(resolvePortalRoute("/login")).toMatchObject({ area: "public", navigation: "hidden" });
    expect(resolvePortalRoute("/auth/callback")).toMatchObject({ area: "public", navigation: "hidden" });
  });

  it("never exposes auth callback routes in primary navigation", () => {
    expect(PRIMARY_PORTAL_ROUTES.map((route) => route.path)).not.toContain("/login");
    expect(PRIMARY_PORTAL_ROUTES.map((route) => route.path)).not.toContain("/auth/callback");
  });
});
