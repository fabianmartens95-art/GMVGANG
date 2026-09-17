import { activeRolesForUser } from "./identity.js";
import type { Membership, Organization, PlatformUser, PlatformUserRole } from "./types.js";

export type PlatformSession =
  | {
      status: "anonymous";
      roles: readonly [];
    }
  | {
      status: "authenticated";
      userId: string;
      email?: string;
      organizationId?: string;
      roles: readonly PlatformUserRole[];
    };

export type VerifiedPlatformIdentity = {
  userId: string;
  emailVerified: boolean;
  expiresAt: string;
};

export type ResolvePlatformSessionInput = {
  identity?: VerifiedPlatformIdentity | null;
  user?: PlatformUser | null;
  memberships: readonly Membership[];
  organizations: readonly Organization[];
  requestedOrganizationId?: string;
  now: string;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field}_INVALID`);
  }
  return parsed;
}

function activeOrganizationIdsForUser(
  userId: string,
  memberships: readonly Membership[],
  organizations: readonly Organization[],
): string[] {
  const activeOrganizationIds = new Set(
    organizations.filter((organization) => organization.status === "active").map((organization) => organization.id),
  );

  return [
    ...new Set(
      memberships
        .filter(
          (membership) =>
            membership.userId === userId &&
            membership.status === "active" &&
            activeOrganizationIds.has(membership.organizationId),
        )
        .map((membership) => membership.organizationId),
    ),
  ];
}

function uniqueRoles(roles: readonly PlatformUserRole[]): PlatformUserRole[] {
  return [...new Set(roles)];
}

export function resolvePlatformSession(input: ResolvePlatformSessionInput): PlatformSession {
  if (!input.identity) {
    return { status: "anonymous", roles: [] };
  }

  if (!input.identity.emailVerified) {
    throw new Error("SESSION_EMAIL_NOT_VERIFIED");
  }

  if (timestamp(input.identity.expiresAt, "SESSION_EXPIRES_AT") <= timestamp(input.now, "SESSION_NOW")) {
    throw new Error("SESSION_EXPIRED");
  }

  if (!input.user || input.user.id !== input.identity.userId || input.user.status !== "active") {
    throw new Error("ACCOUNT_ACCESS_DENIED");
  }

  const accountEmail = input.user.email.trim();
  const requestedOrganizationId = input.requestedOrganizationId?.trim();
  if (requestedOrganizationId) {
    const organization = input.organizations.find((candidate) => candidate.id === requestedOrganizationId);
    if (!organization || organization.status !== "active") {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    const roles = uniqueRoles(activeRolesForUser(input.user.id, requestedOrganizationId, input.memberships));
    if (roles.length === 0) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    return {
      status: "authenticated",
      userId: input.user.id,
      ...(accountEmail ? { email: accountEmail } : {}),
      organizationId: requestedOrganizationId,
      roles,
    };
  }

  const organizationIds = activeOrganizationIdsForUser(input.user.id, input.memberships, input.organizations);
  if (organizationIds.length === 1) {
    const organizationId = organizationIds[0]!;
    return {
      status: "authenticated",
      userId: input.user.id,
      ...(accountEmail ? { email: accountEmail } : {}),
      organizationId,
      roles: uniqueRoles(activeRolesForUser(input.user.id, organizationId, input.memberships)),
    };
  }

  return {
    status: "authenticated",
    userId: input.user.id,
    ...(accountEmail ? { email: accountEmail } : {}),
    roles: [],
  };
}
