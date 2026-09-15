export type PlatformRole =
  | "agency_owner"
  | "agency_admin"
  | "agency_operator"
  | "closer"
  | "creator_manager"
  | "brand_manager"
  | "external_contractor"
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
  | "pipeline.read"
  | "pipeline.write"
  | "outreach.read"
  | "outreach.write"
  | "economics.read"
  | "profile.read"
  | "profile.write"
  | "referrals.read"
  | "referrals.share"
  | "referrals.manage";

export type PlatformMembership = {
  principalId: string;
  workspaceId: string;
  role: PlatformRole;
  brandIds: string[];
  creatorId?: string;
  grantedPermissions?: Permission[];
  revokedPermissions?: Permission[];
};

export type ResourceScope = {
  workspaceId: string;
  brandId?: string;
  creatorId?: string;
};

const ALL_PERMISSIONS: Permission[] = [
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
  "pipeline.read",
  "pipeline.write",
  "outreach.read",
  "outreach.write",
  "economics.read",
  "profile.read",
  "profile.write",
  "referrals.read",
  "referrals.share",
  "referrals.manage",
];

const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<Permission>> = {
  agency_owner: new Set<Permission>(ALL_PERMISSIONS),
  agency_admin: new Set<Permission>(ALL_PERMISSIONS.filter((permission) => permission !== "workspace.manage")),
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
    "pipeline.read",
    "outreach.read",
    "outreach.write",
    "economics.read",
    "profile.read",
    "profile.write",
    "referrals.read",
  ]),
  closer: new Set<Permission>([
    "brands.read",
    "analytics.read",
    "reports.read",
    "pipeline.read",
    "pipeline.write",
    "economics.read",
    "profile.read",
    "profile.write",
  ]),
  creator_manager: new Set<Permission>([
    "brands.read",
    "creators.read",
    "creators.write",
    "campaigns.read",
    "campaigns.write",
    "samples.read",
    "samples.write",
    "analytics.read",
    "reports.read",
    "outreach.read",
    "outreach.write",
    "profile.read",
    "profile.write",
    "referrals.read",
    "referrals.manage",
  ]),
  brand_manager: new Set<Permission>([
    "brands.read",
    "brands.write",
    "creators.read",
    "campaigns.read",
    "campaigns.write",
    "samples.read",
    "analytics.read",
    "reports.read",
    "reports.share",
    "pipeline.read",
    "economics.read",
    "profile.read",
    "profile.write",
  ]),
  external_contractor: new Set<Permission>([
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
    "referrals.read",
    "referrals.share",
  ]),
};

export function hasPermission(
  role: PlatformRole,
  permission: Permission,
  grantedPermissions: Permission[] = [],
  revokedPermissions: Permission[] = [],
): boolean {
  if (revokedPermissions.includes(permission)) return false;
  return ROLE_PERMISSIONS[role].has(permission) || grantedPermissions.includes(permission);
}

export function canAccess(
  membership: PlatformMembership,
  permission: Permission,
  resource: ResourceScope,
): boolean {
  if (membership.workspaceId !== resource.workspaceId) return false;
  if (
    !hasPermission(
      membership.role,
      permission,
      membership.grantedPermissions,
      membership.revokedPermissions,
    )
  ) {
    return false;
  }

  if (membership.role === "agency_owner" || membership.role === "agency_admin") {
    return true;
  }

  if (
    membership.role === "agency_operator" ||
    membership.role === "closer" ||
    membership.role === "creator_manager" ||
    membership.role === "brand_manager" ||
    membership.role === "external_contractor"
  ) {
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
