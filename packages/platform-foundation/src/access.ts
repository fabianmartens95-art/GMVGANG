import type { PlatformUserRole } from "./types.js";

export type PlatformCapability =
  | "platform.manage"
  | "users.manage"
  | "brands.read_all"
  | "brands.manage"
  | "creators.read_all"
  | "creators.manage"
  | "campaigns.read_all"
  | "campaigns.manage"
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
    "brands.read_all",
    "brands.manage",
    "creators.read_all",
    "creators.manage",
    "campaigns.read_all",
    "campaigns.manage",
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
    "brands.read_all",
    "brands.manage",
    "creators.read_all",
    "creators.manage",
    "campaigns.read_all",
    "campaigns.manage",
    "approvals.manage",
  ],
  creator_manager: ["creators.read_all", "creators.manage", "campaigns.read_all", "campaigns.manage"],
  brand_manager: ["brands.read_all", "brands.manage", "campaigns.read_all", "campaigns.manage", "approvals.manage"],
  closer: ["brands.read_all", "campaigns.read_all"],
  creator: ["creator.self.read", "creator.self.update", "creator.referrals.read", "creator.referrals.share"],
  brand_member: [
    "brand.self.read",
    "brand.self.update",
    "brand.shop_connections.manage",
    "brand.campaigns.read",
    "brand.approvals.manage",
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
