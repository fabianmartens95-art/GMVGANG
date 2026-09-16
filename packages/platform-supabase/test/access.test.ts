import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureSupabaseCreatorMembership } from "../src/index.js";

type MembershipRow = { id: string; status: string } | null;

function fakeClient(options?: { organizations?: Array<{ id: string }>; membership?: MembershipRow }) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const organizations = options?.organizations ?? [{ id: "org-gmvgang" }];
  const membership = options?.membership ?? null;

  const client = {
    from(table: string) {
      if (table === "organizations") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async limit() {
                        return { data: organizations, error: null };
                      },
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
                          async maybeSingle() {
                            return { data: membership, error: null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          async insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            return { error: null };
          },
          update(payload: Record<string, unknown>) {
            updated.push(payload);
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          async eq() {
                            return { error: null };
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
  };

  return {
    client: client as unknown as SupabaseClient,
    inserted,
    updated,
  };
}

const NOW = "2026-09-16T02:00:00.000Z";

describe("ensureSupabaseCreatorMembership", () => {
  it("creates an active creator membership in the canonical GMVGANG organization", async () => {
    const fake = fakeClient();

    await ensureSupabaseCreatorMembership(fake.client, "user-1", NOW);

    expect(fake.inserted).toEqual([
      {
        user_id: "user-1",
        organization_id: "org-gmvgang",
        role: "creator",
        status: "active",
        created_at: NOW,
        updated_at: NOW,
      },
    ]);
    expect(fake.updated).toEqual([]);
  });

  it("is idempotent when the creator membership is already active", async () => {
    const fake = fakeClient({ membership: { id: "membership-1", status: "active" } });

    await ensureSupabaseCreatorMembership(fake.client, "user-1", NOW);

    expect(fake.inserted).toEqual([]);
    expect(fake.updated).toEqual([]);
  });

  it("activates an invited creator membership", async () => {
    const fake = fakeClient({ membership: { id: "membership-1", status: "invited" } });

    await ensureSupabaseCreatorMembership(fake.client, "user-1", NOW);

    expect(fake.inserted).toEqual([]);
    expect(fake.updated).toEqual([{ status: "active", updated_at: NOW }]);
  });

  it("never silently reactivates a revoked creator membership", async () => {
    const fake = fakeClient({ membership: { id: "membership-1", status: "revoked" } });

    await expect(ensureSupabaseCreatorMembership(fake.client, "user-1", NOW)).rejects.toThrow(
      "CREATOR_MEMBERSHIP_REVOKED",
    );
    expect(fake.inserted).toEqual([]);
    expect(fake.updated).toEqual([]);
  });

  it("fails closed when the canonical GMVGANG organization is missing or ambiguous", async () => {
    await expect(
      ensureSupabaseCreatorMembership(fakeClient({ organizations: [] }).client, "user-1", NOW),
    ).rejects.toThrow("GMVGANG_ORGANIZATION_MISSING");

    await expect(
      ensureSupabaseCreatorMembership(
        fakeClient({ organizations: [{ id: "one" }, { id: "two" }] }).client,
        "user-1",
        NOW,
      ),
    ).rejects.toThrow("GMVGANG_ORGANIZATION_AMBIGUOUS");
  });
});
