import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createPlatformServer } from "../src/server.js";
import type { PlatformServerConfig } from "../src/env.js";

const servers: ReturnType<typeof createPlatformServer>[] = [];

function config(secret: string): PlatformServerConfig {
  return {
    port: 3000,
    publicOrigin: "https://app.gmvgang.de",
    portalDistDir: "apps/platform-portal/dist",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "publishable",
    supabaseServiceRoleKey: "service-role",
    privacyNoticeVersion: "2026-09-16",
    notionCreatorSync: null,
    notionCreatorWorkspace: null,
    companyOsSyncSecret: secret,
    affiliatePerformanceRead: null,
    production: false,
  };
}

async function start(secret: string): Promise<string> {
  const server = createPlatformServer(config(secret));
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("Company OS snapshot HTTP boundary", () => {
  it("rejects requests without the machine secret before reading snapshot data", async () => {
    const base = await start("s".repeat(43));
    const response = await fetch(`${base}/api/internal/company-os-sync/creators`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_sync_secret" });
  });

  it("accepts all required sources and exposes readiness through health", async () => {
    const secret = "s".repeat(43);
    const base = await start(secret);

    for (const source of ["creators", "campaigns", "assignments"]) {
      const response = await fetch(`${base}/api/internal/company-os-sync/${source}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-os-sync-secret": secret,
        },
        body: JSON.stringify([]),
      });
      expect(response.status).toBe(200);
    }

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      ok: true,
      creatorWorkspaceRead: "company_os_ready",
    });
  });
});
