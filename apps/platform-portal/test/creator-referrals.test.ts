import { describe, expect, it } from "vitest";
import {
  HttpCreatorReferralHubAdapter,
  parseCreatorReferralHub,
  renderCreatorReferralHub,
  type CreatorReferralHubFetch,
} from "../src/creator-referrals.js";

const PAYLOAD = {
  source: "production",
  model: {
    referralCode: "GMVABC123",
    totalReferrals: 2,
    statusCounts: {
      attributed: 0,
      profile_complete: 1,
      qualified: 1,
      contracted: 0,
      active: 0,
      performing: 0,
      rejected: 0,
      fraud_review: 0,
    },
    recentReferrals: [
      { status: "qualified", attributedAt: "2026-09-16T12:00:00.000Z", qualifiedAt: "2026-09-16T13:00:00.000Z" },
      { status: "profile_complete", attributedAt: "2026-09-15T12:00:00.000Z" },
    ],
  },
};

function response(status: number, payload: unknown): Awaited<ReturnType<CreatorReferralHubFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

describe("parseCreatorReferralHub", () => {
  it("accepts the privacy-minimized production contract", () => {
    expect(parseCreatorReferralHub(PAYLOAD)).toEqual({ ok: true, model: PAYLOAD.model });
  });

  it("rejects inconsistent aggregates", () => {
    expect(() => parseCreatorReferralHub({
      ...PAYLOAD,
      model: { ...PAYLOAD.model, totalReferrals: 3 },
    })).toThrow("CREATOR_REFERRAL_HUB_INVALID");
  });
});

describe("HttpCreatorReferralHubAdapter", () => {
  it("reads with same-origin cookie credentials and no-store", async () => {
    let captured: unknown;
    const fetcher: CreatorReferralHubFetch = async (_input, init) => {
      captured = init;
      return response(200, PAYLOAD);
    };
    const adapter = new HttpCreatorReferralHubAdapter("/api/creator/referrals", fetcher);
    await expect(adapter.getHub()).resolves.toEqual({ ok: true, model: PAYLOAD.model });
    expect(captured).toEqual({
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("preserves safe server error codes", async () => {
    const adapter = new HttpCreatorReferralHubAdapter(
      "/api/creator/referrals",
      async () => response(404, { error: "creator_profile_not_found" }),
    );
    await expect(adapter.getHub()).resolves.toEqual({ ok: false, error: "creator_profile_not_found" });
  });
});

describe("renderCreatorReferralHub", () => {
  it("renders the personal share link and aggregate milestones without creator identities", () => {
    const result = parseCreatorReferralHub(PAYLOAD);
    const html = renderCreatorReferralHub(result, "https://app.gmvgang.de");
    expect(html).toContain("https://app.gmvgang.de/join?ref=GMVABC123");
    expect(html).toContain("Qualifiziert+");
    expect(html).toContain("Reward Engine noch nicht aktiviert");
    expect(html).not.toContain("referredCreatorProfileId");
    expect(html).not.toContain("fraudFlags");
  });
});
