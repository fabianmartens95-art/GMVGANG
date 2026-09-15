import type { PlatformMembership } from "@gmvgang/access-control";

export type VerifiedAuthIdentity = {
  provider: string;
  subject: string;
  emailVerified: boolean;
};

export interface AuthIdentityProvider {
  verifySessionCredential(credential: string): Promise<VerifiedAuthIdentity | null>;
}

export interface MembershipRepository {
  findMembership(input: {
    workspaceId: string;
    provider: string;
    subject: string;
  }): Promise<PlatformMembership | null>;
}

export type SessionResolution =
  | { ok: false; reason: "missing_credential" | "invalid_session" | "email_unverified" | "membership_not_found" }
  | { ok: true; identity: VerifiedAuthIdentity; membership: PlatformMembership };

export async function resolvePlatformSession(input: {
  workspaceId: string;
  sessionCredential?: string;
  identityProvider: AuthIdentityProvider;
  memberships: MembershipRepository;
  requireVerifiedEmail?: boolean;
}): Promise<SessionResolution> {
  if (!input.sessionCredential) return { ok: false, reason: "missing_credential" };

  const identity = await input.identityProvider.verifySessionCredential(input.sessionCredential);
  if (!identity) return { ok: false, reason: "invalid_session" };

  if (input.requireVerifiedEmail !== false && !identity.emailVerified) {
    return { ok: false, reason: "email_unverified" };
  }

  const membership = await input.memberships.findMembership({
    workspaceId: input.workspaceId,
    provider: identity.provider,
    subject: identity.subject,
  });
  if (!membership || membership.workspaceId !== input.workspaceId) {
    return { ok: false, reason: "membership_not_found" };
  }

  return { ok: true, identity, membership };
}
