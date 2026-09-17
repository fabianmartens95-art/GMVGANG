import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { manageSupabaseMembership } from "../src/index.js";

const NOW = "2026-09-17T00:01:32.000Z";

type FakeOptions = {
  organizationType?: "gmvgang" | "brand";
  actorRoles?: string[];
  rpcError?: { code?: string; message?: string } | null;
};

function fakeClient(options: FakeOptions = {}) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const organizationType = options.organizationType ?? "gmvgang";
  const actorRoles = options.actorRoles ?? ["admin"];

  const client = {
    from(table: string) {
      if (table === "organizations") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: { id: "org-1", type: organizationType, status: "active" },
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
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          async eq() {
                            return {
                              data: actorRoles.map((role) => ({ role })),
                              error: null,
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (options.rpcError) return { data: null, error: options.rpcError };
      return {
        data: [{
          membership_id: "membership-1",
          user_id: "target-user",
          organization_id: "org-1",
          role: args.p_role,
          status: args.p_status,
          created_at: NOW,
          updated_at: NOW,
        }],
        error: null,
      };
    },
  };

  return { client: client as unknown as SupabaseClient, rpcCalls };
}

describe("manageSupabaseMembership", () => {
  it("allows an admin to manage operational roles in the GMVGANG organization", async () => {
    const fake = fakeClient({ actorRoles: ["admin"] });

    const membership = await manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "target-user",
      organizationId: "org-1",
      role: "creator_manager",
      status: "active",
      now: NOW,
    });

    expect(membership).toEqual({
      id: "membership-1",
      userId: "target-user",
      organizationId: "org-1",
      role: "creator_manager",
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(fake.rpcCalls).toEqual([{
      name: "manage_platform_membership",
      args: {
        p_actor_user_id: "actor-user",
        p_target_user_id: "target-user",
        p_organization_id: "org-1",
        p_role: "creator_manager",
        p_status: "active",
        p_occurred_at: NOW,
      },
    }]);
  });

  it("allows an admin to manage brand members in a brand organization", async () => {
    const fake = fakeClient({ organizationType: "brand", actorRoles: ["admin"] });

    await expect(manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "target-user",
      organizationId: "org-1",
      role: "brand_member",
      status: "invited",
      now: NOW,
    })).resolves.toMatchObject({ role: "brand_member", status: "invited" });

    expect(fake.rpcCalls).toHaveLength(1);
  });

  it("requires founder authority for admin membership mutations", async () => {
    const fake = fakeClient({ actorRoles: ["admin"] });

    await expect(manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "target-user",
      organizationId: "org-1",
      role: "admin",
      status: "active",
      now: NOW,
    })).rejects.toThrow("ADMIN_ROLE_REQUIRES_FOUNDER");

    expect(fake.rpcCalls).toEqual([]);
  });

  it("keeps founder membership unavailable to runtime management", async () => {
    const fake = fakeClient({ actorRoles: ["founder"] });

    await expect(manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "target-user",
      organizationId: "org-1",
      role: "founder",
      status: "active",
      now: NOW,
    })).rejects.toThrow("FOUNDER_ROLE_PROTECTED");

    expect(fake.rpcCalls).toEqual([]);
  });

  it("fails before the RPC when the actor lacks users.manage", async () => {
    const fake = fakeClient({ actorRoles: ["creator"] });

    await expect(manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "target-user",
      organizationId: "org-1",
      role: "creator_manager",
      status: "active",
      now: NOW,
    })).rejects.toThrow("MEMBERSHIP_MANAGEMENT_DENIED");

    expect(fake.rpcCalls).toEqual([]);
  });

  it("preserves known database authorization errors", async () => {
    const fake = fakeClient({
      actorRoles: ["founder"],
      rpcError: { code: "P0001", message: "MEMBERSHIP_TARGET_USER_NOT_FOUND" },
    });

    await expect(manageSupabaseMembership(fake.client, {
      actorUserId: "actor-user",
      targetUserId: "missing-user",
      organizationId: "org-1",
      role: "admin",
      status: "active",
      now: NOW,
    })).rejects.toThrow("MEMBERSHIP_TARGET_USER_NOT_FOUND");
  });
});
