import { describe, expect, it } from "vitest";
import { handleTeamCreatorFunnel } from "../src/team-creator-funnel-http.js";
import type { PlatformApiDependencies, PlatformApiServices, TeamCreatorFunnelReadModel } from "../src/types.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-17T22:00:00.000Z";

const MODEL: TeamCreatorFunnelReadModel = {
  generatedAt: NOW,
  stalledAfterMinutes: 30,
  summary: { totalCreators: 1, completed: 0, stalled: 1, inProgress: 0, registrationsLast24h: 1 },
  creators: [],
};

function dependencies(options: {
  token?: string | null;
  roles?: Array<"founder" | "admin" | "creator_manager" | "creator">;
  includeService?: boolean;
} = {}): PlatformApiDependencies {
  const roles = options.roles ?? ["creator_manager"];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return {
        session: { status: "authenticated", userId: "staff-user", roles },
        workspaces: [],
      };
    },
    ...(options.includeService === false ? {} : {
      async getTeamCreatorFunnel() { return MODEL; },
    }),
    async getCreatorProfile() { return null; },
    async registerCreator() { throw new Error("NOT_USED"); },
    async completeCreatorProfile() { throw new Error("NOT_USED"); },
  };

  return {
    accessTokens: {
      async getAccessToken() { return options.token === undefined ? "access-token" : options.token; },
    },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-16",
  };
}

describe("team creator funnel API", () => {
  it("returns creator operations data for roles with creators.read_all", async () => {
    const response = await handleTeamCreatorFunnel(new Request(`${ORIGIN}/api/team/creator-funnel`), dependencies());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload).toEqual({ model: MODEL, source: "production" });
  });

  it("rejects creator accounts and unauthenticated requests", async () => {
    expect((await handleTeamCreatorFunnel(
      new Request(`${ORIGIN}/api/team/creator-funnel`),
      dependencies({ roles: ["creator"] }),
    )).status).toBe(403);
    expect((await handleTeamCreatorFunnel(
      new Request(`${ORIGIN}/api/team/creator-funnel`),
      dependencies({ token: null }),
    )).status).toBe(401);
  });

  it("fails closed when the read service is unavailable", async () => {
    const response = await handleTeamCreatorFunnel(
      new Request(`${ORIGIN}/api/team/creator-funnel`),
      dependencies({ includeService: false }),
    );
    expect(response.status).toBe(503);
  });

  it("is read-only", async () => {
    const response = await handleTeamCreatorFunnel(
      new Request(`${ORIGIN}/api/team/creator-funnel`, { method: "POST" }),
      dependencies(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
