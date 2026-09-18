import { describe, expect, it } from "vitest";

import {
  authorizeCreatorVerificationTransition,
  publicCreatorVerificationView,
} from "./index.js";

describe("Creator verification governance", () => {
  it("allows a Creator to request review only for their own profile", () => {
    expect(authorizeCreatorVerificationTransition({
      from: "unverified",
      to: "pending_review",
      actor: { kind: "creator", ownsProfile: true },
    })).toEqual({ ok: true });

    expect(authorizeCreatorVerificationTransition({
      from: "unverified",
      to: "pending_review",
      actor: { kind: "creator", ownsProfile: false },
    })).toEqual({
      ok: false,
      error: "CREATOR_VERIFICATION_OWNERSHIP_DENIED",
    });
  });

  it("never allows a Creator to self-decide or reset verified state", () => {
    for (const target of ["verified", "rejected"] as const) {
      expect(authorizeCreatorVerificationTransition({
        from: "pending_review",
        to: target,
        actor: { kind: "creator", ownsProfile: true },
      })).toEqual({
        ok: false,
        error: "CREATOR_VERIFICATION_TRANSITION_DENIED",
      });
    }

    expect(authorizeCreatorVerificationTransition({
      from: "verified",
      to: "pending_review",
      actor: { kind: "creator", ownsProfile: true },
    })).toEqual({
      ok: false,
      error: "CREATOR_VERIFICATION_TRANSITION_DENIED",
    });
  });

  it("requires Creator-management capability for Staff decisions", () => {
    expect(authorizeCreatorVerificationTransition({
      from: "pending_review",
      to: "verified",
      actor: { kind: "staff", canManageCreators: false },
    })).toEqual({
      ok: false,
      error: "CREATOR_VERIFICATION_STAFF_CAPABILITY_REQUIRED",
    });

    expect(authorizeCreatorVerificationTransition({
      from: "pending_review",
      to: "verified",
      actor: { kind: "staff", canManageCreators: true },
    })).toEqual({ ok: true });
  });

  it("forces Staff decisions through pending_review instead of direct verification", () => {
    expect(authorizeCreatorVerificationTransition({
      from: "unverified",
      to: "verified",
      actor: { kind: "staff", canManageCreators: true },
    })).toEqual({
      ok: false,
      error: "CREATOR_VERIFICATION_TRANSITION_DENIED",
    });

    expect(authorizeCreatorVerificationTransition({
      from: "unverified",
      to: "rejected",
      actor: { kind: "staff", canManageCreators: true },
    })).toEqual({
      ok: false,
      error: "CREATOR_VERIFICATION_TRANSITION_DENIED",
    });
  });

  it("supports re-review after rejection and Staff reset after verification", () => {
    expect(authorizeCreatorVerificationTransition({
      from: "rejected",
      to: "pending_review",
      actor: { kind: "creator", ownsProfile: true },
    })).toEqual({ ok: true });

    expect(authorizeCreatorVerificationTransition({
      from: "rejected",
      to: "pending_review",
      actor: { kind: "staff", canManageCreators: true },
    })).toEqual({ ok: true });

    expect(authorizeCreatorVerificationTransition({
      from: "verified",
      to: "pending_review",
      actor: { kind: "staff", canManageCreators: true },
    })).toEqual({ ok: true });
  });

  it("exposes only safe public status and next action", () => {
    expect(publicCreatorVerificationView("unverified")).toEqual({
      status: "unverified",
      badge: "none",
      nextAction: "request_review",
    });

    expect(publicCreatorVerificationView("verified")).toEqual({
      status: "verified",
      badge: "verified",
      nextAction: "none",
    });

    expect(publicCreatorVerificationView("pending_review")).toEqual({
      status: "pending_review",
      badge: "pending",
      nextAction: "wait_for_review",
    });

    expect(publicCreatorVerificationView("rejected")).toEqual({
      status: "rejected",
      badge: "not_verified",
      nextAction: "request_review",
    });
  });
});
