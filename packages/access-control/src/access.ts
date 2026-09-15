export type PlatformRole =
  | "agency_owner"
  | "agency_admin"
  | "agency_operator"
  | "brand_admin"
  | "brand_member"
  | "creator";

export type Permission =
  | "workspace.manage"
  | "users.manage"
  | "brands.read"
  | "brands.write"
  | "creators.read"
  | "creators.write"
  | "campaigns.read"
  | "campaigns.write"
  | "samples.read"
  | "samples.write"
  | "analytics.read"
  | "reports.read"
  | "reports.share"
  | "profile.read"
  | "profile.write";

export type PlatformMembership = {
  principalId: string;
  workspaceId: string;
  role: PlatformRole;
  brandIds: string[];
  creatorId?: string;
};

export type ResourceScope = {
  workspaceId: string;
  brandId?: string;
  creatorId?: string;
};

const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<Permission>> = {
  agency_owner: new Set<Permission>([
    "workspace.manage",
    "users.manage",
    "brands.read",
    "brands.write",
    "creators.read",
    "creators.write",
    "campaigns.read",
    "campaigns.write",
    "samples.read",
    "samples.write",
    "analytics.read",
    "reports.read",
    "reports.share",
    "profile.read",
    "profile.write",
  ]),
  agency_admin: new Set<Permission>([
    "users.manage",
    "brands.read",
    "brands.write",
    "creators.read",
    "creators.write",
    "campaigns.read",
    "campaigns.write",
    "samples.read",
    "samples.write",
    "analytics.read",
    "reports.read",
    "reports.share",
    "profile.read",
    "profile.write",
  ]),
  agency_operator: new Set<Permission>([
    "brands.read",
    "creators.read",
    "creators.write",
    "campaigns.read",
    "campaigns.write",
    "samples.read",
    "samples.write",
    "analytics.read",
    "reports.read",
    "profile.read",
    "profile.write",
  ]),
  brand_admin: new Set<Permission>([
    "brands.read",
    "creators.read",
    "campaigns.read",
    "samples.read",
    "analytics.read",
    "reports.read",
    "reports.share",
    "profile.read",
    "profile.write",
  ]),
  brand_member: new Set<Permission>([
    "brands.read",
    "creators.read",
    "campaigns.read",
    "samples.read",
    "analytics.read",
    "reports.read",
    "profile.read",
    "profile.write",
  ]),
  creator: new Set<Permission>([
    "campaigns.read",
    "samples.read",
    "samples.write",
    "reports.read",
    "profile.read",
    "profile.write",
  ]),
};

export function hasPermission(role: PlatformRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canAccess(
  membership: PlatformMembership,
  permission: Permission,
  resource: ResourceScope,
): boolean {
  if (membership.workspaceId !== resource.workspaceId) return false;
  if (!hasPermission(membership.role, permission)) return false;

  if (membership.role === "agency_owner" || membership.role === "agency_admin") {
    return true;
  }

  if (membership.role === "agency_operator") {
    return resource.brandId ? membership.brandIds.includes(resource.brandId) : true;
  }

  if (membership.role === "brand_admin" || membership.role === "brand_member") {
    if (!resource.brandId) return false;
    return membership.brandIds.includes(resource.brandId);
  }

  if (membership.role === "creator") {
    if (!membership.creatorId || !resource.creatorId) return false;
    return membership.creatorId === resource.creatorId;
  }

  return false;
}
