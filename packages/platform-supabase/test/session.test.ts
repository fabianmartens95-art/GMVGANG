import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSupabasePlatformSession, resolveSupabasePlatformSessionContext } from "../src/index.js";

function fakeClient(options?: { authenticated?: boolean; verified?: boolean; memberships?: boolean }): SupabaseClient {
  const authenticated = options?.authenticated ?? true;
  const verified = options?.verified ?? true;
  const memberships = options?.memberships ?? true;

  const client = {
    auth: {
      async getUser() {
        if (!authenticated) return { data: { user: null }, error: { message: "invalid" } };
        return {
          data: {
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              email: "brand@example.com",
              email_confirmed_at: verified ? "2026-09-15T00:00:00.000Z" : null,
              confirmed_at: verified ? "2026-09-15T00:00:00.000Z" : null,
            },
          },
          error: null,
        };
      },
      async getClaims() {
        if (!authenticated) return { data: null, error: { message: "invalid" } };
        return {
          data: {
            claims: {
              sub: "11111111-1111-4111-8111-111111111111",
              exp: 1893456000,
            },
          },
          error: null,
        };
      },
    },
    from(table: string) {
      if (table === "platform_users") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: "11111111-1111-4111-8111-111111111111",
                        email: "brand@example.com",
                        status: "active",
                        created_at: "2026-09-15T00:00:00.000Z",
                        updated_at: "2026-09-15T00:00:00.000Z",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "memberships") {
        return {
          select() {
            return {
              async eq() {
                return {
                  data: memberships
                    ? [
                        {
                          id: "22222222-2222-4222-8222-222222222222",
                          user_id: "11111111-1111-4111-8111-111111111111",
                          organization_id: "33333333-3333-4333-8333-333333333333",
                          role: "brand_member",
                          status: "active",
                          created_at: "2026-09-15T00:00:00.000Z",
                          updated_at: "2026-09-15T00:00:00.000Z",
                        },
                      ]
                    : [],
                  error: null,
                };
              },
            };
          },
        };
      }
      if (table === "organizations") {
        return {
          select() {
            return {
              async in() {
                return {
                  data: [
                    {
                      id: "33333333-3333-4333-8333-333333333333",
                      type: "brand",
                      name: "Brand One",
                      status: "active",
                      created_at: "2026-09-15T00:00:00.000Z",
                      updated_at: "2026-09-15T00:00:00.000Z",
                    },
                  ],
                  error: null,
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return client as unknown as SupabaseClient;
}

describe("resolveSupabasePlatformSession", () => {
  it("returns anonymous when Supabase rejects the token", async () => {
    await expect(
      resolveSupabasePlatformSession(fakeClient({ authenticated: false }), {
        accessToken: "invalid-token",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).resolves.toEqual({ status: "anonymous", roles: [] });
  });

  it("resolves a verified user into a tenant-bound platform session", async () => {
    await expect(
      resolveSupabasePlatformSession(fakeClient(), {
        accessToken: "verified-token",
        requestedOrganizationId: "33333333-3333-4333-8333-333333333333",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      status: "authenticated",
      userId: "11111111-1111-4111-8111-111111111111",
      email: "brand@example.com",
      organizationId: "33333333-3333-4333-8333-333333333333",
      roles: ["brand_member"],
    });
  });

  it("keeps a verified account without membership authenticated but without tenant roles", async () => {
    await expect(
      resolveSupabasePlatformSession(fakeClient({ memberships: false }), {
        accessToken: "verified-token",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      status: "authenticated",
      userId: "11111111-1111-4111-8111-111111111111",
      email: "brand@example.com",
      roles: [],
    });
  });

  it("fails closed when the auth identity is not email verified", async () => {
    await expect(
      resolveSupabasePlatformSession(fakeClient({ verified: false }), {
        accessToken: "unverified-token",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).rejects.toThrow("SESSION_EMAIL_NOT_VERIFIED");
  });
});

describe("resolveSupabasePlatformSessionContext", () => {
  it("returns the same verified session together with server-derived workspace access", async () => {
    await expect(
      resolveSupabasePlatformSessionContext(fakeClient(), {
        accessToken: "verified-token",
        requestedOrganizationId: "33333333-3333-4333-8333-333333333333",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      session: {
        status: "authenticated",
        userId: "11111111-1111-4111-8111-111111111111",
        email: "brand@example.com",
        organizationId: "33333333-3333-4333-8333-333333333333",
        roles: ["brand_member"],
      },
      workspaces: [
        {
          organizationId: "33333333-3333-4333-8333-333333333333",
          organizationType: "brand",
          name: "Brand One",
          roles: ["brand_member"],
        },
      ],
    });
  });

  it("returns no workspaces when authentication is rejected", async () => {
    await expect(
      resolveSupabasePlatformSessionContext(fakeClient({ authenticated: false }), {
        accessToken: "invalid-token",
        now: "2026-09-16T00:00:00.000Z",
      }),
    ).resolves.toEqual({ session: { status: "anonymous", roles: [] }, workspaces: [] });
  });
});
