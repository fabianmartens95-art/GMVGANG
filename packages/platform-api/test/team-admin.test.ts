import { describe, expect, it } from "vitest";

import { buildTeamAdminReadModel, type TeamAdminSource } from "../src/team-admin.js";

const NOW = "2026-09-18T00:00:00.000Z";

describe("team admin read model", () => {
  it("builds user and membership state and keeps inactive organizations visible", () => {
    const source: TeamAdminSource = {
      users: [
        {
          id: "user-1",
          email: "admin@gmvgang.de",
          status: "active",
          is_test_account: false,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
      memberships: [
        {
          id: "membership-1",
          user_id: "user-1",
          organization_id: "org-1",
          role: "admin",
          status: "active",
          created_at: NOW,
          updated_at: NOW,
          organizations: { name: "Legacy Brand", type: "brand", status: "inactive" },
        },
      ],
      audit: [],
    };

    const model = buildTeamAdminReadModel(source, NOW);
    expect(model.summary).toMatchObject({ totalUsers: 1, activeUsers: 1, memberships: 1 });
    expect(model.users[0]?.memberships[0]).toMatchObject({
      organizationName: "Legacy Brand",
      organizationType: "brand",
      role: "admin",
    });
  });

  it("removes token, cookie, password and secret metadata from the browser read model", () => {
    const source: TeamAdminSource = {
      users: [],
      memberships: [],
      audit: [
        {
          id: "audit-1",
          event: "auth.password.updated",
          user_id: "user-1",
          organization_id: null,
          occurred_at: NOW,
          metadata: {
            requestId: "req-1",
            accessToken: "do-not-expose",
            cookie: "do-not-expose",
            passwordHint: "do-not-expose",
            clientSecret: "do-not-expose",
            safeBoolean: true,
            nested: { ignored: true },
          },
        },
      ],
    };

    const model = buildTeamAdminReadModel(source, NOW);
    expect(model.auditEvents[0]?.metadata).toEqual({
      requestId: "req-1",
      safeBoolean: true,
    });
  });
});
