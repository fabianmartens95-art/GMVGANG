import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCreatorPortalMembership, GMVGANG_PLATFORM_ORGANIZATION_ID } from "../src/index.js";

function clientWithMembership(status: "active" | "invited" | "revoked" | null) {
  const writes: Array<{ type: string; payload: unknown }> = [];
  const client = {
    from(table: string) {
      if (table !== "memberships") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          const chain = {
            eq() { return chain; },
            async maybeSingle() {
              return { data: status ? { id: "membership-1", status } : null, error: null };
            },
          };
          return chain;
        },
        update(payload: unknown) {
          writes.push({ type: "update", payload });
          const chain = {
            eq() { return chain; },
            then(resolve: (value: unknown) => void) { resolve({ error: null }); },
          };
          return chain;
        },
        async insert(payload: unknown) {
          writes.push({ type: "insert", payload });
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, writes };
}

describe("ensureCreatorPortalMembership", () => {
  it("does nothing for an already active Creator membership", async () => {
    const { client, writes } = clientWithMembership("active");
    await ensureCreatorPortalMembership(client, "user-1");
    expect(writes).toHaveLength(0);
  });

  it("activates an invited Creator membership", async () => {
    const { client, writes } = clientWithMembership("invited");
    await ensureCreatorPortalMembership(client, "user-1");
    expect(writes).toEqual([{ type: "update", payload: { status: "active" } }]);
  });

  it("never silently reactivates a revoked membership", async () => {
    const { client, writes } = clientWithMembership("revoked");
    await expect(ensureCreatorPortalMembership(client, "user-1")).rejects.toThrow("CREATOR_MEMBERSHIP_REVOKED");
    expect(writes).toHaveLength(0);
  });

  it("creates a Creator membership in the canonical GMVGANG organization when absent", async () => {
    const { client, writes } = clientWithMembership(null);
    await ensureCreatorPortalMembership(client, "user-1");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.type).toBe("insert");
    expect(writes[0]?.payload).toMatchObject({
      user_id: "user-1",
      organization_id: GMVGANG_PLATFORM_ORGANIZATION_ID,
      role: "creator",
      status: "active",
    });
  });
});
