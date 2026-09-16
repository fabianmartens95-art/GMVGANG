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

const AFFILIATE_ENV = {
  AFFILIATE_PERFORMANCE_READ_ENABLED: "1",
  AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED: "1",
  AFFILIATE_PERFORMANCE_LOOKBACK_DAYS: "30",
  AFFILIATE_PERFORMANCE_MAX_RECORDS: "200",
  AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO: "1",
  AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES: "60",
  AFFILIATE_PERFORMANCE_REQUIRED_METRICS: "gmv,orders,gmv",
};

describe("loadPlatformServerConfig", () => {
  it("loads the production contract and keeps affiliate performance disabled by default", () => {
    const config = loadPlatformServerConfig(BASE_ENV);
    expect(config.port).toBe(8080);
    expect(config.publicOrigin).toBe("https://app.gmvgang.de");
    expect(config.production).toBe(true);
    expect(config.portalDistDir.endsWith("apps/platform-portal/dist")).toBe(true);
    expect(config.notionCreatorSync).toBeNull();
    expect(config.notionCreatorWorkspace).toBeNull();
    expect(config.affiliatePerformanceRead).toBeNull();
  });

  it("loads the Notion Creator sync only when the creator data source and shared server token exist", () => {
    const config = loadPlatformServerConfig({
      ...BASE_ENV,
      NOTION_TOKEN: "secret-test-token",
      NOTION_CREATOR_DATA_SOURCE_ID: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    });

    expect(config.notionCreatorSync).toEqual({
      token: "secret-test-token",
      dataSourceId: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    });
  });

  it("does not activate Creator sync from a shared Notion token alone and fails closed without auth for its data source", () => {
    expect(loadPlatformServerConfig({ ...BASE_ENV, NOTION_TOKEN: "secret-test-token" }).notionCreatorSync).toBeNull();
    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      NOTION_CREATOR_DATA_SOURCE_ID: "8a6eb54f-cefc-4f5b-bda6-57998fd09904",
    })).toThrow("NOTION_CREATOR_SYNC_CONFIG_INCOMPLETE");
  });

  it("requires an explicit enable flag and schema verification before affiliate reads can be configured", () => {
    const config = loadPlatformServerConfig({ ...BASE_ENV, ...AFFILIATE_ENV });
    expect(config.affiliatePerformanceRead).toEqual({
      lookbackDays: 30,
      maxRecords: 200,
      minimumCoverageRatio: 1,
      maxSourceAgeMinutes: 60,
      requiredMetrics: ["gmv", "orders"],
    });

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED: "0",
    })).toThrow("AFFILIATE_PERFORMANCE_SCHEMA_NOT_VERIFIED");
  });

  it("rejects hidden affiliate policy values while the feature is disabled", () => {
    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      AFFILIATE_PERFORMANCE_LOOKBACK_DAYS: "30",
    })).toThrow("AFFILIATE_PERFORMANCE_READ_DISABLED_WITH_CONFIG");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      AFFILIATE_PERFORMANCE_READ_ENABLED: "0",
      AFFILIATE_PERFORMANCE_SCHEMA_VERIFIED: "1",
    })).toThrow("AFFILIATE_PERFORMANCE_READ_DISABLED_WITH_CONFIG");
  });

  it("rejects invalid affiliate activation flags, thresholds, caps, and metric names", () => {
    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      AFFILIATE_PERFORMANCE_READ_ENABLED: "true",
    })).toThrow("AFFILIATE_PERFORMANCE_READ_ENABLED_INVALID");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_LOOKBACK_DAYS: "3651",
    })).toThrow("AFFILIATE_PERFORMANCE_LOOKBACK_DAYS_INVALID");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_MAX_RECORDS: "1001",
    })).toThrow("AFFILIATE_PERFORMANCE_MAX_RECORDS_INVALID");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO: "1.01",
    })).toThrow("AFFILIATE_PERFORMANCE_MIN_COVERAGE_RATIO_INVALID");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES: "0",
    })).toThrow("AFFILIATE_PERFORMANCE_MAX_SOURCE_AGE_MINUTES_INVALID");

    expect(() => loadPlatformServerConfig({
      ...BASE_ENV,
      ...AFFILIATE_ENV,
      AFFILIATE_PERFORMANCE_REQUIRED_METRICS: "gmv,secret_metric",
    })).toThrow("AFFILIATE_PERFORMANCE_REQUIRED_METRICS_INVALID");
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
