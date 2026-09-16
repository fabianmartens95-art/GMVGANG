import { describe, expect, it } from "vitest";
import { handleCreatorWorkspace } from "../src/creator-workspace-http.js";
import type { PlatformApiDependencies, PlatformApiServices } from "../src/types.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-16T18:45:00.000Z";

function dependencies(options: {
  token?: string | null;
  roles?: Array<"founder" | "admin" | "creator">;
  includeWorkspace?: boolean;
  profileMissing?: boolean;
} = {}): PlatformApiDependencies {
  const roles = options.roles ?? ["creator"];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return {
        session: { status: "authenticated", userId: "verified-user", roles },
        workspaces: [],
      };
    },
    async getCreatorProfile() { return null; },
    ...(options.includeWorkspace === false ? {} : {
      async getCreatorWorkspace(input) {
        if (options.profileMissing) return null;
        expect(input).toEqual({ userId: "verified-user", now: NOW });
        return {
          availability: "available" as const,
          generatedAt: NOW,
          syncedAt: NOW,
          matches: [{ campaignId: "campaign-1", campaignName: "Visible Match", status: "new" as const }],
          campaigns: [],
          performance: {
            source: "company-os-operational" as const,
            verification: "provisional" as const,
            currency: null,
            totals: { gmV: 0, orders: 0, commission: 0, postedContent: 0 },
            campaigns: [],
            updatedAt: null,
          },
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

describe("creator workspace API", () => {
  it("returns only the authenticated creator workspace model", async () => {
    const response = await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`), dependencies());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload).toMatchObject({
      source: "production",
      model: { availability: "available", matches: [{ campaignName: "Visible Match" }] },
    });
    expect(JSON.stringify(payload)).not.toContain("verified-user");
  });

  it("requires authentication plus creator portal/self-read capabilities", async () => {
    expect((await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`), dependencies({ token: null }))).status).toBe(401);
    expect((await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`), dependencies({ roles: ["admin"] }))).status).toBe(403);
  });

  it("fails closed when the service is unavailable or no creator profile exists", async () => {
    expect((await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`), dependencies({ includeWorkspace: false }))).status).toBe(503);
    expect((await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`), dependencies({ profileMissing: true }))).status).toBe(404);
  });

  it("is read-only", async () => {
    const response = await handleCreatorWorkspace(new Request(`${ORIGIN}/api/creator/workspace`, { method: "POST" }), dependencies());
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
