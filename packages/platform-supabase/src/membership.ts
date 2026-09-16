import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GMVGANG_PLATFORM_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export async function ensureCreatorPortalMembership(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("CREATOR_MEMBERSHIP_USER_REQUIRED");

  const existing = await client
    .from("memberships")
    .select("id,status")
    .eq("user_id", normalizedUserId)
    .eq("organization_id", GMVGANG_PLATFORM_ORGANIZATION_ID)
    .eq("role", "creator")
    .maybeSingle();

  if (existing.error) {
    throw new Error(`CREATOR_MEMBERSHIP_QUERY_FAILED:${existing.error.code ?? "unknown"}`);
  }

  if (existing.data) {
    if (existing.data.status === "revoked") {
      throw new Error("CREATOR_MEMBERSHIP_REVOKED");
    }
    if (existing.data.status === "active") return;

    const updated = await client
      .from("memberships")
      .update({ status: "active" })
      .eq("id", existing.data.id)
      .eq("user_id", normalizedUserId)
      .eq("role", "creator");
    if (updated.error) {
      throw new Error(`CREATOR_MEMBERSHIP_UPDATE_FAILED:${updated.error.code ?? "unknown"}`);
    }
    return;
  }

  const created = await client.from("memberships").insert({
    id: randomUUID(),
    user_id: normalizedUserId,
    organization_id: GMVGANG_PLATFORM_ORGANIZATION_ID,
    role: "creator",
    status: "active",
  });
  if (created.error) {
    throw new Error(`CREATOR_MEMBERSHIP_INSERT_FAILED:${created.error.code ?? "unknown"}`);
  }
}
