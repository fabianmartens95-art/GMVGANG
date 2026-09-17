import { describe, expect, it } from "vitest";
import { createPlatformApiHandler } from "../src/analytics-http.js";
import type {
  PlatformApiDependencies,
  PlatformApiServices,
  PortalAnalyticsEventInput,
} from "../src/types.js";

const ORIGIN = "https://app.gmvgang.de";
const NOW = "2026-09-17T21:00:00.000Z";
const SESSION_ID = "4b8cd9fb-2d47-4d7d-a7d4-5b1f72c0ad65";

function dependencies(options: { token?: string | null } = {}) {
  const recorded: PortalAnalyticsEventInput[] = [];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return {
        session: {
          status: "authenticated",
          userId: "verified-user",
          organizationId: "verified-org",
          roles: ["creator"],
        },
        workspaces: [],
      };
    },
    async recordAnalyticsEvent(input) {
      recorded.push(input);
    },
    async getCreatorProfile() { return null; },
    async registerCreator() { throw new Error("NOT_USED"); },
    async completeCreatorProfile() { throw new Error("NOT_USED"); },
  };

  const value: PlatformApiDependencies = {
    accessTokens: {
      async getAccessToken() {
        return options.token === undefined ? "access-token" : options.token;
      },
    },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09",
  };
  return { value, recorded };
}

function analyticsRequest(
  body: unknown,
  options: { origin?: string; requestId?: string } = {},
): Request {
  return new Request(`${ORIGIN}/api/analytics/events`, {
    method: "POST",
    headers: {
      Origin: options.origin ?? ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json",
      ...(options.requestId ? { "X-Request-Id": options.requestId } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("portal analytics API", () => {
  it("derives identity from the verified session and records only allowlisted telemetry", async () => {
    const { value, recorded } = dependencies();
    const handler = createPlatformApiHandler(value);
    const response = await handler(analyticsRequest({
      eventName: "portal.navigation",
      path: "/creator",
      clientSessionId: SESSION_ID,
      properties: { targetPath: "/creator/qualification" },
      userId: "forged-user",
      email: "should-not-be-recorded@example.com",
    }, { requestId: "request-123" }));

    expect(response.status).toBe(202);
    expect(recorded).toEqual([{
      userId: "verified-user",
      organizationId: "verified-org",
      eventName: "portal.navigation",
      path: "/creator",
      clientSessionId: SESSION_ID,
      requestId: "request-123",
      properties: { targetPath: "/creator/qualification" },
      occurredAt: NOW,
    }]);
  });

  it("rejects anonymous, cross-origin and non-allowlisted telemetry", async () => {
    const anonymous = dependencies({ token: null });
    expect((await createPlatformApiHandler(anonymous.value)(analyticsRequest({
      eventName: "portal.page_view",
      path: "/creator",
      clientSessionId: SESSION_ID,
      properties: {},
    }))).status).toBe(401);

    const crossOrigin = dependencies();
    expect((await createPlatformApiHandler(crossOrigin.value)(analyticsRequest({
      eventName: "portal.page_view",
      path: "/creator",
      clientSessionId: SESSION_ID,
      properties: {},
    }, { origin: "https://evil.example" }))).status).toBe(403);

    const invalid = dependencies();
    expect((await createPlatformApiHandler(invalid.value)(analyticsRequest({
      eventName: "portal.page_view",
      path: "/creator?secret=value",
      clientSessionId: SESSION_ID,
      properties: { email: "nope@example.com" },
    }))).status).toBe(400);
    expect(invalid.recorded).toHaveLength(0);
  });
});
