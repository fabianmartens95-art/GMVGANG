import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  loadPlatformSessionContext,
  type Membership,
  type Organization,
  type PlatformIdentityPort,
  type PlatformSession,
  type PlatformSessionContext,
  type PlatformSessionPersistencePort,
  type PlatformUser,
  type PlatformUserRole,
  type VerifiedPlatformIdentity,
} from "@gmvgang/platform-foundation";

export type SupabaseSessionInput = {
  accessToken: string;
  requestedOrganizationId?: string;
  now: string;
};

function required(value: string, code: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function assertTimestamp(value: string, code: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
  return value;
}

function platformUserFromRow(row: Record<string, unknown>): PlatformUser {
  if (
    typeof row.id !== "string" ||
    typeof row.email !== "string" ||
    !["pending", "active", "suspended", "disabled"].includes(String(row.status)) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("PLATFORM_USER_ROW_INVALID");
  }

  return {
    id: row.id,
    email: row.email,
    status: row.status as PlatformUser["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function membershipFromRow(row: Record<string, unknown>): Membership {
  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.organization_id !== "string" ||
    !["founder", "admin", "creator_manager", "brand_manager", "closer", "creator", "brand_member"].includes(String(row.role)) ||
    !["invited", "active", "revoked"].includes(String(row.status)) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("MEMBERSHIP_ROW_INVALID");
  }

  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    role: row.role as PlatformUserRole,
    status: row.status as Membership["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function organizationFromRow(row: Record<string, unknown>): Organization {
  if (
    typeof row.id !== "string" ||
    !["gmvgang", "brand"].includes(String(row.type)) ||
    typeof row.name !== "string" ||
    !["active", "inactive"].includes(String(row.status)) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("ORGANIZATION_ROW_INVALID");
  }

  return {
    id: row.id,
    type: row.type as Organization["type"],
    name: row.name,
    status: row.status as Organization["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emailVerified(user: User): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function claimsExpiry(claims: Record<string, unknown>): string {
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) {
    throw new Error("SUPABASE_TOKEN_EXPIRY_INVALID");
  }
  return new Date(claims.exp * 1000).toISOString();
}

function createSupabaseIdentityPort(client: SupabaseClient, accessToken: string): PlatformIdentityPort {
  return {
    async verifyIdentity(): Promise<VerifiedPlatformIdentity | null> {
      const [userResult, claimsResult] = await Promise.all([
        client.auth.getUser(accessToken),
        client.auth.getClaims(accessToken),
      ]);

      if (userResult.error || !userResult.data.user) return null;
      if (claimsResult.error || !claimsResult.data?.claims) return null;

      const user = userResult.data.user;
      const claims = claimsResult.data.claims as Record<string, unknown>;
      if (claims.sub !== user.id) throw new Error("SUPABASE_IDENTITY_MISMATCH");

      return {
        userId: user.id,
        emailVerified: emailVerified(user),
        expiresAt: claimsExpiry(claims),
      };
    },
  };
}

function createSupabaseSessionPersistence(client: SupabaseClient): PlatformSessionPersistencePort {
  return {
    async findUserById(userId) {
      const result = await client
        .from("platform_users")
        .select("id,email,status,created_at,updated_at")
        .eq("id", userId)
        .maybeSingle();
      if (result.error) throw new Error(`PLATFORM_USER_QUERY_FAILED:${result.error.code ?? "unknown"}`);
      return result.data ? platformUserFromRow(result.data as Record<string, unknown>) : null;
    },

    async listMembershipsForUser(userId) {
      const result = await client
        .from("memberships")
        .select("id,user_id,organization_id,role,status,created_at,updated_at")
        .eq("user_id", userId);
      if (result.error) throw new Error(`MEMBERSHIP_QUERY_FAILED:${result.error.code ?? "unknown"}`);
      return (result.data ?? []).map((row) => membershipFromRow(row as Record<string, unknown>));
    },

    async listOrganizationsByIds(organizationIds) {
      if (organizationIds.length === 0) return [];
      const result = await client
        .from("organizations")
        .select("id,type,name,status,created_at,updated_at")
        .in("id", [...organizationIds]);
      if (result.error) throw new Error(`ORGANIZATION_QUERY_FAILED:${result.error.code ?? "unknown"}`);
      return (result.data ?? []).map((row) => organizationFromRow(row as Record<string, unknown>));
    },
  };
}

export async function resolveSupabasePlatformSessionContext(
  client: SupabaseClient,
  input: SupabaseSessionInput,
): Promise<PlatformSessionContext> {
  const accessToken = required(input.accessToken, "SUPABASE_ACCESS_TOKEN_REQUIRED");
  const now = assertTimestamp(input.now, "SESSION_NOW_INVALID");
  const requestedOrganizationId = input.requestedOrganizationId?.trim();

  return loadPlatformSessionContext({
    identity: createSupabaseIdentityPort(client, accessToken),
    persistence: createSupabaseSessionPersistence(client),
    ...(requestedOrganizationId ? { requestedOrganizationId } : {}),
    now,
  });
}

export async function resolveSupabasePlatformSession(
  client: SupabaseClient,
  input: SupabaseSessionInput,
): Promise<PlatformSession> {
  return (await resolveSupabasePlatformSessionContext(client, input)).session;
}
