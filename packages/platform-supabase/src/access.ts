import type { SupabaseClient } from "@supabase/supabase-js";

function ensureNoError(error: { code?: string; message?: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.code ?? "unknown"}`);
}

function requiredUserId(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error("PLATFORM_USER_ID_REQUIRED");
  return cleaned;
}

function validTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error("MEMBERSHIP_TIMESTAMP_INVALID");
  return value;
}

async function canonicalGmvgangOrganizationId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("organizations")
    .select("id")
    .eq("type", "gmvgang")
    .eq("status", "active")
    .limit(2);
  ensureNoError(error, "GMVGANG_ORGANIZATION_QUERY_FAILED");

  const rows = data ?? [];
  if (rows.length !== 1 || typeof rows[0]?.id !== "string") {
    throw new Error(rows.length > 1 ? "GMVGANG_ORGANIZATION_AMBIGUOUS" : "GMVGANG_ORGANIZATION_MISSING");
  }
  return rows[0].id;
}

export async function ensureSupabaseCreatorMembership(
  client: SupabaseClient,
  userIdValue: string,
  nowValue: string,
): Promise<void> {
  const userId = requiredUserId(userIdValue);
  const now = validTimestamp(nowValue);
  const organizationId = await canonicalGmvgangOrganizationId(client);

  const { data: existing, error: existingError } = await client
    .from("memberships")
    .select("id,status")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("role", "creator")
    .maybeSingle();
  ensureNoError(existingError, "CREATOR_MEMBERSHIP_QUERY_FAILED");

  if (existing) {
    if (existing.status === "active") return;
    if (existing.status === "revoked") throw new Error("CREATOR_MEMBERSHIP_REVOKED");
    if (existing.status !== "invited" || typeof existing.id !== "string") {
      throw new Error("CREATOR_MEMBERSHIP_ROW_INVALID");
    }

    const { error } = await client
      .from("memberships")
      .update({ status: "active", updated_at: now })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("role", "creator");
    ensureNoError(error, "CREATOR_MEMBERSHIP_UPDATE_FAILED");
    return;
  }

  const { error } = await client.from("memberships").insert({
    user_id: userId,
    organization_id: organizationId,
    role: "creator",
    status: "active",
    created_at: now,
    updated_at: now,
  });
  ensureNoError(error, "CREATOR_MEMBERSHIP_INSERT_FAILED");
}
