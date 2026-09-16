import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GMVGANG_PLATFORM_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export async function ensureCreatorPortalMembership(client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await client
    .from("memberships")
    .select("id,status")
    .eq("user_id", userId)
    .eq("organization_id", GMVGANG_PLATFORM_ORGANIZATION_ID)
    .eq("role", "creator")
    .maybeSingle();

  if (error) throw new Error(`CREATOR_MEMBERSHIP_QUERY_FAILED:${error.code ?? "unknown"}`);

  if (data?.status === "active") return;
  if (data?.status === "revoked") throw new Error("CREATOR_MEMBERSHIP_REVOKED");

  if (data?.id) {
    const { error: updateError } = await client
      .from("memberships")
      .update({ status: "active" })
      .eq("id", data.id);
    if (updateError) throw new Error(`CREATOR_MEMBERSHIP_UPDATE_FAILED:${updateError.code ?? "unknown"}`);
    return;
  }

  const { error: insertError } = await client.from("memberships").insert({
    id: randomUUID(),
    user_id: userId,
    organization_id: GMVGANG_PLATFORM_ORGANIZATION_ID,
    role: "creator",
    status: "active",
  });
  if (insertError) throw new Error(`CREATOR_MEMBERSHIP_INSERT_FAILED:${insertError.code ?? "unknown"}`);
}
