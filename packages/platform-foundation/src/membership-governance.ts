import { anyRoleHasCapability } from "./access.js";
import type { OrganizationType, PlatformUserRole } from "./types.js";

export type MembershipGovernanceError =
  | "MEMBERSHIP_MANAGEMENT_DENIED"
  | "FOUNDER_ROLE_PROTECTED"
  | "ADMIN_ROLE_REQUIRES_FOUNDER"
  | "MEMBERSHIP_ROLE_SCOPE_MISMATCH";

export type MembershipGovernanceDecision =
  | { ok: true }
  | { ok: false; error: MembershipGovernanceError };

export type MembershipGovernanceInput = {
  actorRoles: readonly PlatformUserRole[];
  targetRole: PlatformUserRole;
  organizationType: OrganizationType;
};

const GMVGANG_SCOPED_ROLES: readonly PlatformUserRole[] = [
  "admin",
  "creator_manager",
  "brand_manager",
  "closer",
  "creator",
];

function roleMatchesOrganization(role: PlatformUserRole, organizationType: OrganizationType): boolean {
  if (role === "brand_member") return organizationType === "brand";
  if (GMVGANG_SCOPED_ROLES.includes(role)) return organizationType === "gmvgang";
  return false;
}

/**
 * Central authorization policy for server-side membership mutations.
 *
 * Founder membership is bootstrap-only and cannot be granted/revoked through
 * normal runtime membership management. Admin membership is a privileged role
 * that only an active founder may manage. All other managed roles are scoped to
 * their owning organization type so a malformed request cannot turn a Brand
 * workspace into a Team workspace (or vice versa).
 */
export function authorizeMembershipMutation(input: MembershipGovernanceInput): MembershipGovernanceDecision {
  if (!anyRoleHasCapability(input.actorRoles, "users.manage")) {
    return { ok: false, error: "MEMBERSHIP_MANAGEMENT_DENIED" };
  }

  if (input.targetRole === "founder") {
    return { ok: false, error: "FOUNDER_ROLE_PROTECTED" };
  }

  if (input.targetRole === "admin" && !input.actorRoles.includes("founder")) {
    return { ok: false, error: "ADMIN_ROLE_REQUIRES_FOUNDER" };
  }

  if (!roleMatchesOrganization(input.targetRole, input.organizationType)) {
    return { ok: false, error: "MEMBERSHIP_ROLE_SCOPE_MISMATCH" };
  }

  return { ok: true };
}
