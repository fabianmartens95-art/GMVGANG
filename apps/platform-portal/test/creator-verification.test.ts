import { describe, expect, it } from "vitest";
import {
  HttpCreatorVerificationAdapter,
  parseCreatorVerification,
  renderCreatorVerification,
} from "../src/creator-verification.js";

const CASES = [
  ["unverified", "none", "request_review", "Verifizierung noch nicht angefordert"],
  ["pending_review", "pending", "wait_for_review", "Verifizierung wird geprüft"],
  ["verified", "verified", "none", "Creator verifiziert"],
  ["rejected", "not_verified", "request_review", "Aktuell nicht verifiziert"],
] as const;

describe("Creator Verification surface", () => {
  it("renders every canonical public verification state distinctly", () => {
    for (const [status, badge, nextAction, copy] of CASES) {
      const response = parseCreatorVerification({
        verification: { status, badge, nextAction },
      });
      expect(renderCreatorVerification(response)).toContain(copy);
    }
  });

  it("fails closed on unknown or inconsistent state combinations", () => {
    expect(() => parseCreatorVerification({
      verification: { status: "manual_override", badge: "verified", nextAction: "none" },
    })).toThrow("CREATOR_VERIFICATION_STATE_INVALID");

    expect(() => parseCreatorVerification({
      verification: { status: "verified", badge: "pending", nextAction: "none" },
    })).toThrow("CREATOR_VERIFICATION_STATE_INCONSISTENT");

    expect(() => parseCreatorVerification({
      verification: { status: "rejected", badge: "not_verified", nextAction: "none" },
    })).toThrow("CREATOR_VERIFICATION_STATE_INCONSISTENT");
  });

  it("rejects internal review metadata instead of accepting it into the public read model", () => {
    expect(() => parseCreatorVerification({
      verification: {
        status: "pending_review",
        badge: "pending",
        nextAction: "wait_for_review",
        reviewReason: "internal-only",
      },
    })).toThrow("CREATOR_VERIFICATION_PAYLOAD_INVALID");

    expect(() => parseCreatorVerification({
      verification: {
        status: "pending_review",
        badge: "pending",
        nextAction: "wait_for_review",
      },
      internalEvidence: ["secret"],
    })).toThrow("CREATOR_VERIFICATION_PAYLOAD_INVALID");
  });

  it("keeps Creator identity server-derived with no browser selector", async () => {
    const calls: unknown[] = [];
    const adapter = new HttpCreatorVerificationAdapter(
      "/api/creator/verification",
      async (input, init) => {
        calls.push({ input, init });
        return {
          ok: true,
          async json() {
            return {
              verification: {
                status: "pending_review",
                badge: "pending",
                nextAction: "wait_for_review",
              },
            };
          },
        };
      },
    );

    await expect(adapter.getVerification()).resolves.not.toBeNull();
    expect(calls).toEqual([{
      input: "/api/creator/verification",
      init: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    }]);
  });

  it("contains no self-verification mutation or internal decision details", () => {
    const html = renderCreatorVerification(parseCreatorVerification({
      verification: {
        status: "unverified",
        badge: "none",
        nextAction: "request_review",
      },
    }));
    expect(html).not.toContain("verified=true");
    expect(html).not.toContain("data-action");
    expect(html).not.toContain("approve");
    expect(html).not.toContain("reject");
  });

  it("degrades malformed HTTP responses to unavailable", async () => {
    const adapter = new HttpCreatorVerificationAdapter(
      "/api/creator/verification",
      async () => ({
        ok: true,
        async json() { return { verification: { status: "fake" } }; },
      }),
    );

    await expect(adapter.getVerification()).resolves.toBeNull();
    expect(renderCreatorVerification(null)).toContain("Status nicht verfügbar");
  });
});
