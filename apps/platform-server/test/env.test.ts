import { describe, expect, it } from "vitest";

import { loadPlatformServerConfig } from "../src/env.js";

const BASE_ENV = {
  NODE_ENV: "production",
  PORT: "8080",
  PLATFORM_PUBLIC_ORIGIN: "https://app.gmvgang.de",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  CREATOR_PRIVACY_NOTICE_VERSION: "2026-09",
};

describe("loadPlatformServerConfig", () => {
  it("loads the production contract and normalizes the public origin", () => {
    const config = loadPlatformServerConfig(BASE_ENV);
    expect(config.port).toBe(8080);
    expect(config.publicOrigin).toBe("https://app.gmvgang.de");
    expect(config.production).toBe(true);
    expect(config.portalDistDir.endsWith("apps/platform-portal/dist")).toBe(true);
  });

  it("fails closed when required Supabase or privacy settings are missing", () => {
    expect(() => loadPlatformServerConfig({ ...BASE_ENV, SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY_REQUIRED",
    );
    expect(() => loadPlatformServerConfig({ ...BASE_ENV, CREATOR_PRIVACY_NOTICE_VERSION: "" })).toThrow(
      "CREATOR_PRIVACY_NOTICE_VERSION_REQUIRED",
    );
  });

  it("rejects origins containing paths or invalid ports", () => {
    expect(() => loadPlatformServerConfig({ ...BASE_ENV, PLATFORM_PUBLIC_ORIGIN: "https://app.gmvgang.de/login" })).toThrow(
      "PLATFORM_PUBLIC_ORIGIN_INVALID",
    );
    expect(() => loadPlatformServerConfig({ ...BASE_ENV, PORT: "70000" })).toThrow("PORT_INVALID");
  });
});
