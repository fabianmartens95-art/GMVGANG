import { describe, expect, it } from "vitest";

import { handleTeamAdminOverview } from "../src/team-admin-http.js";
import type { PlatformApiDependencies, PlatformApiServices, TeamAdminReadModel } from "../src/types.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-18T00:00:00.000Z";

const MODEL: TeamAdminReadModel = {
  generatedAt: NOW,
  summary: {
    totalUsers: 1,
    activeUsers: 1,
    suspendedUsers: 0,
    disabledUsers: 0,
    memberships: 1,
    recentAuditEvents: 1,
  },
  users: [],
  auditEvents: [],
};

function dependencies(options: {
  token?: string | null;
  roles?: Array<"founder" | "admin" | "creator_manager" | "creator">;
  includeService?: boolean;
} = {}): PlatformApiDependencies {
  const roles = options.roles ?? ["admin"];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return {
        session: { status: "authenticated", userId: "staff-user", roles },
        workspaces: [],
      };
    },
    ...(options.includeService === false ? {} : {
      async getTeamAdminOverview() { return MODEL; },
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

describe("team admin overview API", () => {
  it("returns the security center only to users.manage roles", async () => {
    const response = await handleTeamAdminOverview(
      new Request(`${ORIGIN}/api/team/admin`),
      dependencies(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ model: MODEL, source: "production" });
  });

  it("rejects staff without users.manage and unauthenticated requests", async () => {
    expect((await handleTeamAdminOverview(
      new Request(`${ORIGIN}/api/team/admin`),
      dependencies({ roles: ["creator_manager"] }),
    )).status).toBe(403);

    expect((await handleTeamAdminOverview(
      new Request(`${ORIGIN}/api/team/admin`),
      dependencies({ token: null }),
    )).status).toBe(401);
  });

  it("fails closed when the privileged read service is unavailable", async () => {
    const response = await handleTeamAdminOverview(
      new Request(`${ORIGIN}/api/team/admin`),
      dependencies({ includeService: false }),
    );
    expect(response.status).toBe(503);
  });

  it("is read-only", async () => {
    const response = await handleTeamAdminOverview(
      new Request(`${ORIGIN}/api/team/admin`, { method: "POST" }),
      dependencies(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
