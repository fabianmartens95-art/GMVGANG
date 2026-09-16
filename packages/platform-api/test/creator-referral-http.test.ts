import { describe, expect, it } from "vitest";
import type { PlatformApiDependencies, PlatformApiServices } from "../src/types.js";
import { handleCreatorReferralHub } from "../src/creator-referral-http.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-16T17:00:00.000Z";

function dependencies(options: {
  token?: string | null;
  roles?: Array<"founder" | "admin" | "creator">;
  includeHub?: boolean;
  profileMissing?: boolean;
} = {}): PlatformApiDependencies {
  const roles = options.roles ?? ["creator"];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return {
        session: {
          status: "authenticated",
          userId: "verified-user",
          roles,
        },
        workspaces: [],
      };
    },
    async getCreatorProfile() { return null; },
    ...(options.includeHub === false ? {} : {
      async getCreatorReferralHub(input) {
        if (options.profileMissing) return null;
        expect(input).toEqual({ userId: "verified-user", now: NOW });
        return {
          referralCode: "GMVABC123",
          totalReferrals: 1,
          statusCounts: {
            attributed: 0,
            profile_complete: 0,
            qualified: 1,
            contracted: 0,
            active: 0,
            performing: 0,
            rejected: 0,
            fraud_review: 0,
          },
          recentReferrals: [{ status: "qualified", attributedAt: "2026-09-16T10:00:00.000Z" }],
        };
      },
    }),
    async registerCreator() { throw new Error("NOT_USED"); },
    async completeCreatorProfile() { throw new Error("NOT_USED"); },
  };

  return {
    accessTokens: {
      async getAccessToken() {
        return options.token === undefined ? "access-token" : options.token;
      },
    },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-16",
  };
}

async function json(response: Response) {
  return response.json();
}

describe("creator referral hub API", () => {
  it("returns only the authenticated creator read model", async () => {
    const response = await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`), dependencies());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await json(response);
    expect(payload).toMatchObject({
      source: "production",
      model: { referralCode: "GMVABC123", totalReferrals: 1 },
    });
    expect(JSON.stringify(payload)).not.toContain("verified-user");
  });

  it("requires authentication and creator referral capability", async () => {
    expect((await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`), dependencies({ token: null }))).status).toBe(401);
    expect((await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`), dependencies({ roles: ["admin"] }))).status).toBe(403);
  });

  it("fails closed when the service is unavailable or no creator profile exists", async () => {
    expect((await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`), dependencies({ includeHub: false }))).status).toBe(503);
    expect((await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`), dependencies({ profileMissing: true }))).status).toBe(404);
  });

  it("is read-only", async () => {
    const response = await handleCreatorReferralHub(new Request(`${ORIGIN}/api/creator/referrals`, { method: "POST" }), dependencies());
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
