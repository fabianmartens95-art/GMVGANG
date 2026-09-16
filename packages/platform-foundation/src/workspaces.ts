import type { Membership, Organization, OrganizationType, PlatformUserRole } from "./types.js";

export interface PlatformWorkspaceAccess {
  organizationId: string;
  organizationType: OrganizationType;
  name: string;
  roles: readonly PlatformUserRole[];
}

export function accessibleWorkspacesForUser(
  userId: string,
  memberships: readonly Membership[],
  organizations: readonly Organization[],
): PlatformWorkspaceAccess[] {
  const activeOrganizations = new Map(
    organizations
      .filter((organization) => organization.status === "active")
      .map((organization) => [organization.id, organization] as const),
  );

  const rolesByOrganization = new Map<string, Set<PlatformUserRole>>();
  for (const membership of memberships) {
    if (
      membership.userId !== userId ||
      membership.status !== "active" ||
      !activeOrganizations.has(membership.organizationId)
    ) {
      continue;
    }

    const roles = rolesByOrganization.get(membership.organizationId) ?? new Set<PlatformUserRole>();
    roles.add(membership.role);
    rolesByOrganization.set(membership.organizationId, roles);
  }

  return [...rolesByOrganization.entries()]
    .map(([organizationId, roles]) => {
      const organization = activeOrganizations.get(organizationId)!;
      return {
        organizationId,
        organizationType: organization.type,
        name: organization.name,
        roles: [...roles],
      } satisfies PlatformWorkspaceAccess;
    })
    .sort((left, right) => {
      if (left.organizationType !== right.organizationType) {
        return left.organizationType === "gmvgang" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "de", { sensitivity: "base" });
    });
}
