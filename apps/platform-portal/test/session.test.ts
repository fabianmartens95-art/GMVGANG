import { describe, expect, it } from "vitest";

import { HttpSessionAdapter, parsePortalSession } from "../src/session.js";

describe("parsePortalSession", () => {
  it("accepts anonymous and tenant-bound authenticated sessions", () => {
    expect(parsePortalSession({ status: "anonymous" })).toEqual({ status: "anonymous", roles: [] });

    expect(
      parsePortalSession({
        status: "authenticated",
        userId: "user-1",
        email: "member@example.com",
        organizationId: "brand-1",
        roles: ["brand_member", "brand_member"],
      }),
    ).toEqual({
      status: "authenticated",
      userId: "user-1",
      email: "member@example.com",
      organizationId: "brand-1",
      roles: ["brand_member"],
    });
  });

  it("rejects unknown roles and role-bearing sessions without a tenant", () => {
    expect(() =>
      parsePortalSession({
        status: "authenticated",
        userId: "user-1",
        organizationId: "brand-1",
        roles: ["super_admin"],
      }),
    ).toThrow("SESSION_IDENTITY_INVALID");

    expect(() =>
      parsePortalSession({
        status: "authenticated",
        userId: "user-1",
        roles: ["brand_member"],
      }),
    ).toThrow("SESSION_TENANT_REQUIRED");
  });
});

describe("HttpSessionAdapter", () => {
  it("requests a same-origin no-store session with credentials", async () => {
    let capturedInput = "";
    let capturedInit: unknown;
    const adapter = new HttpSessionAdapter("/api/session", async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return {
        ok: true,
        async json() {
          return {
            status: "authenticated",
            userId: "user-1",
            email: "member@example.com",
            organizationId: "brand-1",
            roles: ["brand_member"],
          };
        },
      };
    });

    await expect(adapter.getSession()).resolves.toEqual({
      status: "authenticated",
      userId: "user-1",
      email: "member@example.com",
      organizationId: "brand-1",
      roles: ["brand_member"],
    });
    expect(capturedInput).toBe("/api/session");
    expect(capturedInit).toEqual({
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("sends a requested organization only as untrusted server-validated request context", async () => {
    let capturedInit: unknown;
    const adapter = new HttpSessionAdapter(
      "/api/session",
      async (_input, init) => {
        capturedInit = init;
        return {
          ok: true,
          async json() {
            return {
              status: "authenticated",
              userId: "user-1",
              email: "member@example.com",
              organizationId: "brand-2",
              roles: ["brand_member"],
            };
          },
        };
      },
      "brand-2",
    );

    await expect(adapter.getSession()).resolves.toMatchObject({ organizationId: "brand-2" });
    expect(capturedInit).toEqual({
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-GMVGANG-Organization-Id": "brand-2",
      },
    });
  });

  it("fails closed on transport errors, non-success responses and malformed payloads", async () => {
    const transportFailure = new HttpSessionAdapter("/api/session", async () => {
      throw new Error("network");
    });
    await expect(transportFailure.getSession()).resolves.toEqual({ status: "anonymous", roles: [] });

    const rejected = new HttpSessionAdapter("/api/session", async () => ({
      ok: false,
      async json() {
        return {};
      },
    }));
    await expect(rejected.getSession()).resolves.toEqual({ status: "anonymous", roles: [] });

    const malformed = new HttpSessionAdapter("/api/session", async () => ({
      ok: true,
      async json() {
        return { status: "authenticated", userId: "user-1", roles: ["brand_member"] };
      },
    }));
    await expect(malformed.getSession()).resolves.toEqual({ status: "anonymous", roles: [] });
  });
});
