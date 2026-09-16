import { resolvePlatformSession, type PlatformSession, type VerifiedPlatformIdentity } from "./session.js";
import type { Membership, Organization, PlatformUser } from "./types.js";
import { accessibleWorkspacesForUser, type PlatformWorkspaceAccess } from "./workspaces.js";

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

export type PlatformSessionContext = {
  session: PlatformSession;
  workspaces: readonly PlatformWorkspaceAccess[];
};

function uniqueOrganizationIds(memberships: readonly Membership[]): string[] {
  return [...new Set(memberships.map((membership) => membership.organizationId))];
}

function requestedOrganization(input: LoadPlatformSessionInput): { requestedOrganizationId: string } | Record<string, never> {
  return input.requestedOrganizationId ? { requestedOrganizationId: input.requestedOrganizationId } : {};
}

export async function loadPlatformSessionContext(input: LoadPlatformSessionInput): Promise<PlatformSessionContext> {
  const verifiedIdentity = await input.identity.verifyIdentity();
  if (!verifiedIdentity) {
    return {
      session: { status: "anonymous", roles: [] },
      workspaces: [],
    };
  }

  const user = await input.persistence.findUserById(verifiedIdentity.userId);
  if (!user) {
    return {
      session: resolvePlatformSession({
        identity: verifiedIdentity,
        user: null,
        memberships: [],
        organizations: [],
        ...requestedOrganization(input),
        now: input.now,
      }),
      workspaces: [],
    };
  }

  const memberships = await input.persistence.listMembershipsForUser(user.id);
  const organizationIds = uniqueOrganizationIds(memberships);
  const organizations = organizationIds.length > 0
    ? await input.persistence.listOrganizationsByIds(organizationIds)
    : [];

  return {
    session: resolvePlatformSession({
      identity: verifiedIdentity,
      user,
      memberships,
      organizations,
      ...requestedOrganization(input),
      now: input.now,
    }),
    workspaces: accessibleWorkspacesForUser(user.id, memberships, organizations),
  };
}

export async function loadPlatformSession(input: LoadPlatformSessionInput): Promise<PlatformSession> {
  return (await loadPlatformSessionContext(input)).session;
}
