import type { Membership, Organization, PlatformUserRole } from "./types.js";

export function activeRolesForUser(
  userId: string,
  organizationId: string,
  memberships: readonly Membership[],
): PlatformUserRole[] {
  return memberships
    .filter(
      (membership) =>
        membership.userId === userId &&
        membership.organizationId === organizationId &&
        membership.status === "active",
    )
    .map((membership) => membership.role);
}

export function assertOrganizationAccess(
  userId: string,
  organization: Organization,
  memberships: readonly Membership[],
): void {
  const roles = activeRolesForUser(userId, organization.id, memberships);
  if (organization.status !== "active" || roles.length === 0) {
    throw new Error("ORGANIZATION_ACCESS_DENIED");
  }
}
