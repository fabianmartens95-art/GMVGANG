import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeMembershipMutation,
  type Membership,
  type OrganizationType,
  type PlatformUserRole,
} from "@gmvgang/platform-foundation";

export type ManageSupabaseMembershipInput = {
  actorUserId: string;
  targetUserId: string;
  organizationId: string;
  role: PlatformUserRole;
  status: Membership["status"];
  now: string;
};

const PLATFORM_ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];

function required(value: string, code: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function validTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error("MEMBERSHIP_TIMESTAMP_INVALID");
  return value;
}

function platformRole(value: unknown): PlatformUserRole {
  if (typeof value !== "string" || !PLATFORM_ROLES.includes(value as PlatformUserRole)) {
    throw new Error("MEMBERSHIP_ROLE_ROW_INVALID");
  }
  return value as PlatformUserRole;
}

function organizationType(row: Record<string, unknown> | null): OrganizationType {
  if (!row || row.status !== "active" || (row.type !== "gmvgang" && row.type !== "brand")) {
    throw new Error("ORGANIZATION_ACCESS_DENIED");
  }
  return row.type;
}

function membershipFromRpc(row: Record<string, unknown> | null): Membership {
  if (
    !row ||
    typeof row.membership_id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.organization_id !== "string" ||
    !["invited", "active", "revoked"].includes(String(row.status)) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("MEMBERSHIP_MUTATION_ROW_INVALID");
  }

  return {
    id: row.membership_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: platformRole(row.role),
    status: row.status as Membership["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mutationError(error: { code?: string; message?: string }): Error {
  const known = [
    "MEMBERSHIP_IDENTITY_REQUIRED",
    "MEMBERSHIP_TIMESTAMP_REQUIRED",
    "MEMBERSHIP_ROLE_INVALID",
    "MEMBERSHIP_STATUS_INVALID",
    "ORGANIZATION_ACCESS_DENIED",
    "MEMBERSHIP_TARGET_USER_NOT_FOUND",
    "MEMBERSHIP_MANAGEMENT_DENIED",
    "FOUNDER_ROLE_PROTECTED",
    "ADMIN_ROLE_REQUIRES_FOUNDER",
    "MEMBERSHIP_ROLE_SCOPE_MISMATCH",
    "MEMBERSHIP_NOT_FOUND",
  ].find((code) => error.message?.includes(code));

  return new Error(known ?? `MEMBERSHIP_MUTATION_FAILED:${error.code ?? "unknown"}`);
}

export async function manageSupabaseMembership(
  client: SupabaseClient,
  input: ManageSupabaseMembershipInput,
): Promise<Membership> {
  const actorUserId = required(input.actorUserId, "MEMBERSHIP_ACTOR_USER_ID_REQUIRED");
  const targetUserId = required(input.targetUserId, "MEMBERSHIP_TARGET_USER_ID_REQUIRED");
  const organizationId = required(input.organizationId, "MEMBERSHIP_ORGANIZATION_ID_REQUIRED");
  const now = validTimestamp(input.now);

  const [organizationResult, actorMembershipResult] = await Promise.all([
    client
      .from("organizations")
      .select("id,type,status")
      .eq("id", organizationId)
      .maybeSingle(),
    client
      .from("memberships")
      .select("role,organizations!inner(type,status)")
      .eq("user_id", actorUserId)
      .eq("status", "active")
      .eq("organizations.type", "gmvgang")
      .eq("organizations.status", "active"),
  ]);

  if (organizationResult.error) {
    throw new Error(`ORGANIZATION_QUERY_FAILED:${organizationResult.error.code ?? "unknown"}`);
  }
  if (actorMembershipResult.error) {
    throw new Error(`MEMBERSHIP_ACTOR_QUERY_FAILED:${actorMembershipResult.error.code ?? "unknown"}`);
  }

  const targetOrganizationType = organizationType(
    (organizationResult.data ?? null) as Record<string, unknown> | null,
  );
  const actorRoles = (actorMembershipResult.data ?? []).map((row) =>
    platformRole((row as Record<string, unknown>).role),
  );

  const decision = authorizeMembershipMutation({
    actorRoles,
    targetRole: input.role,
    organizationType: targetOrganizationType,
  });
  if (!decision.ok) throw new Error(decision.error);

  const { data, error } = await client.rpc("manage_platform_membership", {
    p_actor_user_id: actorUserId,
    p_target_user_id: targetUserId,
    p_organization_id: organizationId,
    p_role: input.role,
    p_status: input.status,
    p_occurred_at: now,
  });
  if (error) throw mutationError(error);

  const row = Array.isArray(data) ? data[0] : data;
  return membershipFromRpc((row ?? null) as Record<string, unknown> | null);
}
