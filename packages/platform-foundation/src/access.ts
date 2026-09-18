import type { PlatformUserRole } from "./types.js";

export type PlatformCapability =
  | "platform.manage"
  | "users.manage"
  | "team.workspace.read"
  | "creator.portal.access"
  | "brand.portal.access"
  | "brands.read_all"
  | "brands.manage"
  | "creators.read_all"
  | "creators.manage"
  | "campaigns.read_all"
  | "campaigns.manage"
  | "products.manage"
  | "approvals.manage"
  | "creator.self.read"
  | "creator.self.update"
  | "creator.referrals.read"
  | "creator.referrals.share"
  | "brand.self.read"
  | "brand.self.update"
  | "brand.shop_connections.manage"
  | "brand.campaigns.read"
  | "brand.approvals.manage";

const ROLE_CAPABILITIES: Record<PlatformUserRole, readonly PlatformCapability[]> = {
  founder: [
    "platform.manage",
    "users.manage",
    "team.workspace.read",
    "creator.portal.access",
    "brand.portal.access",
    "brands.read_all",
    "brands.manage",
    "creators.read_all",
    "creators.manage",
    "campaigns.read_all",
    "campaigns.manage",
    "products.manage",
    "approvals.manage",
    "creator.self.read",
    "creator.self.update",
    "creator.referrals.read",
    "creator.referrals.share",
    "brand.self.read",
    "brand.self.update",
    "brand.shop_connections.manage",
    "brand.campaigns.read",
    "brand.approvals.manage",
  ],
  admin: [
    "users.manage",
    "team.workspace.read",
    "creator.portal.access",
    "brand.portal.access",
    "brands.read_all",
    "brands.manage",
    "creators.read_all",
    "creators.manage",
    "campaigns.read_all",
    "campaigns.manage",
    "products.manage",
    "approvals.manage",
  ],
  creator_manager: ["team.workspace.read", "creators.read_all", "creators.manage", "campaigns.read_all", "campaigns.manage"],
  brand_manager: [
    "team.workspace.read",
    "brands.read_all",
    "brands.manage",
    "campaigns.read_all",
    "campaigns.manage",
    "products.manage",
    "approvals.manage",
  ],
  closer: ["team.workspace.read", "brands.read_all", "campaigns.read_all"],
  creator: [
    "creator.portal.access",
    "creator.self.read",
    "creator.self.update",
    "creator.referrals.read",
    "creator.referrals.share",
  ],
  brand_member: [
    "brand.portal.access",
    "brand.self.read",
    "brand.self.update",
    "brand.shop_connections.manage",
    "brand.campaigns.read",
    "brand.approvals.manage",
    "products.manage",
  ],
};

export function capabilitiesForRole(role: PlatformUserRole): readonly PlatformCapability[] {
  return ROLE_CAPABILITIES[role];
}

export function roleHasCapability(role: PlatformUserRole, capability: PlatformCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function anyRoleHasCapability(roles: readonly PlatformUserRole[], capability: PlatformCapability): boolean {
  return roles.some((role) => roleHasCapability(role, capability));
}
