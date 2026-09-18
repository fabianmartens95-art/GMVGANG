export type CreatorVerificationStatus =
  | "unverified"
  | "pending_review"
  | "verified"
  | "rejected";

export type CreatorVerificationActor =
  | { kind: "creator"; ownsProfile: boolean }
  | { kind: "staff"; canManageCreators: boolean };

export type CreatorVerificationTransition = {
  from: CreatorVerificationStatus;
  to: CreatorVerificationStatus;
  actor: CreatorVerificationActor;
};

export type CreatorVerificationDecision =
  | { ok: true }
  | {
      ok: false;
      error:
        | "CREATOR_VERIFICATION_OWNERSHIP_DENIED"
        | "CREATOR_VERIFICATION_STAFF_CAPABILITY_REQUIRED"
        | "CREATOR_VERIFICATION_TRANSITION_DENIED";
    };

export type CreatorVerificationPublicView = {
  status: CreatorVerificationStatus;
  badge: "none" | "pending" | "verified" | "not_verified";
  nextAction: "request_review" | "wait_for_review" | "none";
};

export function authorizeCreatorVerificationTransition(
  input: CreatorVerificationTransition,
): CreatorVerificationDecision {
  const { from, to, actor } = input;

  if (actor.kind === "creator") {
    if (!actor.ownsProfile) {
      return { ok: false, error: "CREATOR_VERIFICATION_OWNERSHIP_DENIED" };
    }

    const allowed =
      (from === "unverified" || from === "rejected") &&
      to === "pending_review";

    return allowed
      ? { ok: true }
      : { ok: false, error: "CREATOR_VERIFICATION_TRANSITION_DENIED" };
  }

  if (!actor.canManageCreators) {
    return { ok: false, error: "CREATOR_VERIFICATION_STAFF_CAPABILITY_REQUIRED" };
  }

  const staffAllowed =
    (from === "pending_review" && (to === "verified" || to === "rejected")) ||
    (from === "verified" && to === "pending_review") ||
    (from === "rejected" && to === "pending_review");

  return staffAllowed
    ? { ok: true }
    : { ok: false, error: "CREATOR_VERIFICATION_TRANSITION_DENIED" };
}

export function publicCreatorVerificationView(
  status: CreatorVerificationStatus,
): CreatorVerificationPublicView {
  if (status === "pending_review") {
    return {
      status,
      badge: "pending",
      nextAction: "wait_for_review",
    };
  }

  if (status === "verified") {
    return {
      status,
      badge: "verified",
      nextAction: "none",
    };
  }

  return {
    status,
    badge: status === "rejected" ? "not_verified" : "none",
    nextAction: "request_review",
  };
}
