import { describe, expect, it } from "vitest";
import { loadPlatformServerConfig } from "../src/env.js";

function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PLATFORM_PUBLIC_ORIGIN: "https://app.gmvgang.de",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "publishable",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    CREATOR_PRIVACY_NOTICE_VERSION: "2026-09-16",
  };
}

describe("Company OS workspace sync environment", () => {
  it("is disabled when no sync secret is configured", () => {
    expect(loadPlatformServerConfig(baseEnv()).companyOsSyncSecret).toBeNull();
  });

  it("rejects weak sync secrets", () => {
    expect(() => loadPlatformServerConfig({
      ...baseEnv(),
      COMPANY_OS_SYNC_SECRET: "too-short",
    })).toThrow("COMPANY_OS_SYNC_SECRET_TOO_SHORT");
  });

  it("enables snapshot-backed Creator workspace without a direct Notion assignment source", () => {
    const secret = "x".repeat(43);
    const config = loadPlatformServerConfig({
      ...baseEnv(),
      COMPANY_OS_SYNC_SECRET: secret,
    });

    expect(config.companyOsSyncSecret).toBe(secret);
    expect(config.notionCreatorWorkspace).toBeNull();
  });
});
