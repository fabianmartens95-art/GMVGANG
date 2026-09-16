import { describe, expect, it } from "vitest";
import { unavailableBrandPortalReadModel } from "@gmvgang/brand-intelligence/portal";
import type { PlatformUserRole } from "@gmvgang/platform-foundation";
import { createPlatformApiHandler, type PlatformApiDependencies, type PlatformApiServices } from "../src/index.js";

const NOW = "2026-09-16T16:15:00.000Z";
const ORIGIN = "https://app.gmvgang.de";

function handlerFor(options: {
  token?: string | null;
  organizationId?: string;
  organizationType?: "brand" | "gmvgang";
  roles?: PlatformUserRole[];
  includePort?: boolean;
  returnedOrganizationId?: string;
} = {}) {
  const calls: Array<{ organizationId: string; userId: string; now: string }> = [];
  const organizationId = options.organizationId ?? "brand-1";
  const roles = options.roles ?? ["brand_member"];

  const services: PlatformApiServices = {
    async resolveSessionContext(input) {
      return {
        session: {
          status: "authenticated",
          userId: "user-1",
          organizationId,
          roles,
        },
        workspaces: [{
          organizationId,
          organizationType: options.organizationType ?? "brand",
          name: "Workspace",
          roles,
        }],
      };
    },
    ...(options.includePort === false ? {} : {
      async getBrandOverview(input) {
        calls.push(input);
        return unavailableBrandPortalReadModel(options.returnedOrganizationId ?? input.organizationId, input.now);
      },
    }),
    async getCreatorProfile() { return null; },
    async registerCreator() { throw new Error("NOT_USED"); },
    async completeCreatorProfile() { throw new Error("NOT_USED"); },
  };

  const dependencies: PlatformApiDependencies = {
    accessTokens: {
      async getAccessToken() {
        return options.token === undefined ? "access-token" : options.token;
      },
    },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-16",
  };

  return { handler: createPlatformApiHandler(dependencies), calls };
}

async function json(response: Response) {
  return response.json();
}

describe("brand overview API", () => {
  it("returns a tenant-bound production model for a brand portal member", async () => {
    const { handler, calls } = handlerFor();
    const response = await handler(new Request(`${ORIGIN}/api/brand/overview`, {
      headers: { "X-GMVGANG-Organization-Id": "brand-1" },
    }));

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({
      source: "production",
      model: {
        organizationId: "brand-1",
        profitability: null,
        performance: null,
        dataStatus: { affiliatePerformance: "unavailable" },
      },
    });
    expect(calls).toEqual([{ organizationId: "brand-1", userId: "user-1", now: NOW }]);
  });

  it("rejects missing authentication before invoking the read port", async () => {
    const { handler, calls } = handlerFor({ token: null });
    const response = await handler(new Request(`${ORIGIN}/api/brand/overview`));
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("rejects a non-brand workspace and roles without brand portal capability", async () => {
    const nonBrand = handlerFor({ organizationType: "gmvgang" });
    expect((await nonBrand.handler(new Request(`${ORIGIN}/api/brand/overview`))).status).toBe(403);
    expect(nonBrand.calls).toEqual([]);

    const creatorOnly = handlerFor({ roles: ["creator"] });
    expect((await creatorOnly.handler(new Request(`${ORIGIN}/api/brand/overview`))).status).toBe(403);
    expect(creatorOnly.calls).toEqual([]);
  });

  it("fails closed when no overview port is configured", async () => {
    const { handler } = handlerFor({ includePort: false });
    const response = await handler(new Request(`${ORIGIN}/api/brand/overview`));
    expect(response.status).toBe(503);
    await expect(json(response)).resolves.toEqual({ error: "brand_overview_unavailable" });
  });

  it("does not expose data if a provider returns another tenant", async () => {
    const { handler } = handlerFor({ returnedOrganizationId: "brand-2" });
    const response = await handler(new Request(`${ORIGIN}/api/brand/overview`));
    expect(response.status).toBe(500);
    await expect(json(response)).resolves.toEqual({ error: "internal_error" });
  });

  it("rejects unsupported mutation methods", async () => {
    const { handler } = handlerFor();
    const response = await handler(new Request(`${ORIGIN}/api/brand/overview`, { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
