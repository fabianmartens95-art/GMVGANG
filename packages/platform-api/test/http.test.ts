import { describe, expect, it } from "vitest";
import type { CreatorProfile } from "@gmvgang/platform-foundation";

import { createPlatformApiHandler, type PlatformApiDependencies, type PlatformApiServices } from "../src/index.js";

const NOW = "2026-09-16T03:30:00.000Z";
const ORIGIN = "https://app.gmvgang.de";

const creatorProfile: CreatorProfile = {
  id: "creator-profile-1",
  userId: "verified-user",
  tiktokHandle: "creator.one",
  networkStatus: "registered",
  profileCompletionPercent: 20,
  referralCode: "GMVABC123",
  createdAt: NOW,
  updatedAt: NOW,
};

type Captures = {
  sessions: Array<{ accessToken: string; requestedOrganizationId?: string; now: string }>;
  registrations: Array<{ userId: string; tiktokHandle: string; privacyNoticeVersion: string }>;
};

function setup(options?: {
  token?: string | null;
  authenticated?: boolean;
  privacyNoticeVersion?: string;
  serviceError?: Error;
}): { handler: (request: Request) => Promise<Response>; captures: Captures } {
  const captures: Captures = { sessions: [], registrations: [] };
  const authenticated = options?.authenticated ?? true;

  const services: PlatformApiServices = {
    async resolveSessionContext(input) {
      captures.sessions.push(input);
      if (options?.serviceError) throw options.serviceError;
      if (!authenticated) return { session: { status: "anonymous", roles: [] }, workspaces: [] };
      return {
        session: { status: "authenticated", userId: "verified-user", roles: [] },
        workspaces: [
          {
            organizationId: "brand-1",
            organizationType: "brand",
            name: "Brand One",
            roles: ["brand_member"],
          },
        ],
      };
    },
    async registerCreator(input, context) {
      captures.registrations.push({
        userId: context.userId,
        tiktokHandle: input.tiktokHandle,
        privacyNoticeVersion: input.privacyNoticeVersion,
      });
      return {
        ok: true,
        created: true,
        creatorProfile,
        referral: { status: "none" },
      };
    },
  };

  const dependencies: PlatformApiDependencies = {
    accessTokens: {
      async getAccessToken() {
        return options?.token === undefined ? "verified-access-token" : options.token;
      },
    },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: options?.privacyNoticeVersion ?? "2026-09-16",
  };

  return { handler: createPlatformApiHandler(dependencies), captures };
}

async function body(response: Response): Promise<unknown> {
  return response.json();
}

describe("platform API session", () => {
  it("returns anonymous without invoking persistence when no access token is available", async () => {
    const { handler, captures } = setup({ token: null });
    const response = await handler(new Request(`${ORIGIN}/api/session`));

    expect(response.status).toBe(200);
    await expect(body(response)).resolves.toEqual({ status: "anonymous", roles: [] });
    expect(captures.sessions).toEqual([]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("passes the organization header only as request context to the server resolver", async () => {
    const { handler, captures } = setup();
    const response = await handler(
      new Request(`${ORIGIN}/api/session`, {
        headers: { "X-GMVGANG-Organization-Id": " brand-1 " },
      }),
    );

    expect(response.status).toBe(200);
    expect(captures.sessions).toEqual([
      {
        accessToken: "verified-access-token",
        requestedOrganizationId: "brand-1",
        now: NOW,
      },
    ]);
  });

  it("rejects unsupported session methods", async () => {
    const { handler } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/session`, { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});

describe("platform API workspaces", () => {
  it("returns only workspaces produced by the verified session service", async () => {
    const { handler } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/workspaces`));

    expect(response.status).toBe(200);
    await expect(body(response)).resolves.toEqual([
      {
        organizationId: "brand-1",
        organizationType: "brand",
        name: "Brand One",
        roles: ["brand_member"],
      },
    ]);
  });

  it("returns an empty list for an anonymous verified result", async () => {
    const { handler } = setup({ authenticated: false });
    const response = await handler(new Request(`${ORIGIN}/api/workspaces`));
    await expect(body(response)).resolves.toEqual([]);
  });
});

describe("platform API Creator Registration", () => {
  it("rejects cross-origin mutations before authentication or domain writes", async () => {
    const { handler, captures } = setup();
    const response = await handler(
      new Request(`${ORIGIN}/api/creator/registration`, {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    await expect(body(response)).resolves.toEqual({ ok: false, errors: ["same_origin_required"] });
    expect(captures.sessions).toEqual([]);
    expect(captures.registrations).toEqual([]);
  });

  it("rejects a stale privacy notice version on the server", async () => {
    const { handler, captures } = setup({ privacyNoticeVersion: "2026-09-16" });
    const response = await handler(
      new Request(`${ORIGIN}/api/creator/registration`, {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokHandle: "@creator.one",
          ageConfirmed: true,
          privacyAccepted: true,
          privacyNoticeVersion: "2026-08-01",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(body(response)).resolves.toEqual({ ok: false, errors: ["privacy_notice_version_outdated"] });
    expect(captures.registrations).toEqual([]);
  });

  it("derives user identity from the verified session and ignores a client-supplied userId", async () => {
    const { handler, captures } = setup();
    const response = await handler(
      new Request(`${ORIGIN}/api/creator/registration`, {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          "Sec-Fetch-Site": "same-origin",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "attacker-controlled-user",
          tiktokHandle: "@creator.one",
          ageConfirmed: true,
          privacyAccepted: true,
          privacyNoticeVersion: "2026-09-16",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(captures.registrations).toEqual([
      {
        userId: "verified-user",
        tiktokHandle: "@creator.one",
        privacyNoticeVersion: "2026-09-16",
      },
    ]);

    const payload = (await body(response)) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("verified-user");
    expect(JSON.stringify(payload)).not.toContain("attacker-controlled-user");
  });

  it("requires an authenticated server session before registration", async () => {
    const { handler, captures } = setup({ authenticated: false });
    const response = await handler(
      new Request(`${ORIGIN}/api/creator/registration`, {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokHandle: "@creator.one",
          ageConfirmed: true,
          privacyAccepted: true,
          privacyNoticeVersion: "2026-09-16",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(captures.registrations).toEqual([]);
  });
});

describe("platform API error surface", () => {
  it("does not expose internal adapter error details", async () => {
    const { handler } = setup({ serviceError: new Error("DATABASE_PASSWORD=do-not-leak") });
    const response = await handler(new Request(`${ORIGIN}/api/session`));
    expect(response.status).toBe(500);
    await expect(body(response)).resolves.toEqual({ error: "internal_error" });
  });

  it("returns a generic 404 outside the explicit API surface", async () => {
    const { handler } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/unknown`));
    expect(response.status).toBe(404);
    await expect(body(response)).resolves.toEqual({ error: "not_found" });
  });
});
