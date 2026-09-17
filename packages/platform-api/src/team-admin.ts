import type {
  AccountStatus,
  OrganizationType,
  PlatformUserRole,
} from "@gmvgang/platform-foundation";
import type {
  TeamAdminAuditEvent,
  TeamAdminMembership,
  TeamAdminReadModel,
  TeamAdminUser,
} from "./types.js";

const ROLES: readonly PlatformUserRole[] = [
  "founder",
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
  "brand_member",
];

const ACCOUNT_STATUSES: readonly AccountStatus[] = ["pending", "active", "suspended", "disabled"];
const MEMBERSHIP_STATUSES: readonly TeamAdminMembership["status"][] = ["invited", "active", "revoked"];
const ORGANIZATION_TYPES: readonly OrganizationType[] = ["gmvgang", "brand"];
const SENSITIVE_METADATA_KEY = /(authorization|cookie|password|secret|token)/i;

export type TeamAdminSource = {
  users: Array<{
    id: string;
    email: string | null;
    status: string;
    is_test_account: boolean;
    created_at: string;
    updated_at: string;
  }>;
  memberships: Array<{
    id: string;
    user_id: string;
    organization_id: string;
    role: string;
    status: string;
    created_at: string;
    updated_at: string;
    organizations: {
      name: string;
      type: string;
      status: string;
    } | Array<{
      name: string;
      type: string;
      status: string;
    }> | null;
  }>;
  audit: Array<{
    id: string;
    event: string;
    user_id: string | null;
    organization_id: string | null;
    occurred_at: string;
    metadata: unknown;
  }>;
};

function accountStatus(value: string): AccountStatus {
  if (!ACCOUNT_STATUSES.includes(value as AccountStatus)) throw new Error("TEAM_ADMIN_ACCOUNT_STATUS_INVALID");
  return value as AccountStatus;
}

function membershipRole(value: string): PlatformUserRole {
  if (!ROLES.includes(value as PlatformUserRole)) throw new Error("TEAM_ADMIN_ROLE_INVALID");
  return value as PlatformUserRole;
}

function membershipStatus(value: string): TeamAdminMembership["status"] {
  if (!MEMBERSHIP_STATUSES.includes(value as TeamAdminMembership["status"])) {
    throw new Error("TEAM_ADMIN_MEMBERSHIP_STATUS_INVALID");
  }
  return value as TeamAdminMembership["status"];
}

function organizationType(value: string): OrganizationType {
  if (!ORGANIZATION_TYPES.includes(value as OrganizationType)) throw new Error("TEAM_ADMIN_ORGANIZATION_TYPE_INVALID");
  return value as OrganizationType;
}

function organization(
  value: TeamAdminSource["memberships"][number]["organizations"],
): { name: string; type: OrganizationType } {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || row.status !== "active" || !row.name.trim()) throw new Error("TEAM_ADMIN_ORGANIZATION_INVALID");
  return { name: row.name.trim(), type: organizationType(row.type) };
}

function sanitizeAuditMetadata(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (SENSITIVE_METADATA_KEY.test(key)) continue;
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "number" ||
      typeof candidate === "boolean"
    ) {
      result[key] = candidate;
      continue;
    }
    if (Array.isArray(candidate) && candidate.length <= 50 && candidate.every((item) =>
      item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"
    )) {
      result[key] = candidate;
    }
  }
  return result;
}

export function buildTeamAdminReadModel(source: TeamAdminSource, now: string): TeamAdminReadModel {
  const membershipsByUser = new Map<string, TeamAdminMembership[]>();

  for (const row of source.memberships) {
    const org = organization(row.organizations);
    const membership: TeamAdminMembership = {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      organizationName: org.name,
      organizationType: org.type,
      role: membershipRole(row.role),
      status: membershipStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    const list = membershipsByUser.get(row.user_id) ?? [];
    list.push(membership);
    membershipsByUser.set(row.user_id, list);
  }

  const users: TeamAdminUser[] = source.users.map((row) => ({
    id: row.id,
    email: row.email,
    status: accountStatus(row.status),
    isTestAccount: row.is_test_account,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberships: (membershipsByUser.get(row.id) ?? []).sort((a, b) =>
      a.organizationName.localeCompare(b.organizationName) || a.role.localeCompare(b.role)
    ),
  }));

  const auditEvents: TeamAdminAuditEvent[] = source.audit.map((row) => ({
    id: row.id,
    event: row.event,
    userId: row.user_id,
    organizationId: row.organization_id,
    occurredAt: row.occurred_at,
    metadata: sanitizeAuditMetadata(row.metadata),
  }));

  return {
    generatedAt: now,
    summary: {
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.status === "active").length,
      suspendedUsers: users.filter((user) => user.status === "suspended").length,
      disabledUsers: users.filter((user) => user.status === "disabled").length,
      memberships: source.memberships.length,
      recentAuditEvents: auditEvents.length,
    },
    users,
    auditEvents,
  };
}
