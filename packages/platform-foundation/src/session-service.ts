import { resolvePlatformSession, type PlatformSession, type VerifiedPlatformIdentity } from "./session.js";
import type { Membership, Organization, PlatformUser } from "./types.js";

export interface PlatformIdentityPort {
  verifyIdentity(): Promise<VerifiedPlatformIdentity | null>;
}

export interface PlatformSessionPersistencePort {
  findUserById(userId: string): Promise<PlatformUser | null>;
  listMembershipsForUser(userId: string): Promise<readonly Membership[]>;
  listOrganizationsByIds(organizationIds: readonly string[]): Promise<readonly Organization[]>;
}

export type LoadPlatformSessionInput = {
  identity: PlatformIdentityPort;
  persistence: PlatformSessionPersistencePort;
  requestedOrganizationId?: string;
  now: string;
};

function uniqueOrganizationIds(memberships: readonly Membership[]): string[] {
  return [...new Set(memberships.map((membership) => membership.organizationId))];
}

export async function loadPlatformSession(input: LoadPlatformSessionInput): Promise<PlatformSession> {
  const verifiedIdentity = await input.identity.verifyIdentity();
  if (!verifiedIdentity) {
    return { status: "anonymous", roles: [] };
  }

  const user = await input.persistence.findUserById(verifiedIdentity.userId);
  if (!user) {
    return resolvePlatformSession({
      identity: verifiedIdentity,
      user: null,
      memberships: [],
      organizations: [],
      requestedOrganizationId: input.requestedOrganizationId,
      now: input.now,
    });
  }

  const memberships = await input.persistence.listMembershipsForUser(user.id);
  const organizationIds = uniqueOrganizationIds(memberships);
  const organizations = organizationIds.length > 0
    ? await input.persistence.listOrganizationsByIds(organizationIds)
    : [];

  return resolvePlatformSession({
    identity: verifiedIdentity,
    user,
    memberships,
    organizations,
    requestedOrganizationId: input.requestedOrganizationId,
    now: input.now,
  });
}
