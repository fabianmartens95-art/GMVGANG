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

describe("creator workspace environment config", () => {
  it("stays disabled when no assignment data source is configured", () => {
    expect(loadPlatformServerConfig(baseEnv()).notionCreatorWorkspace).toBeNull();
  });

  it("reuses the server-side Notion token only when the assignment source is explicitly configured", () => {
    const config = loadPlatformServerConfig({
      ...baseEnv(),
      NOTION_TOKEN: "notion-secret",
      NOTION_ASSIGNMENT_DATA_SOURCE_ID: "22222222-2222-2222-2222-222222222222",
    });
    expect(config.notionCreatorWorkspace).toEqual({
      token: "notion-secret",
      assignmentDataSourceId: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("fails closed when an assignment source is configured without server-side Notion authorization", () => {
    expect(() => loadPlatformServerConfig({
      ...baseEnv(),
      NOTION_ASSIGNMENT_DATA_SOURCE_ID: "22222222-2222-2222-2222-222222222222",
    })).toThrow("NOTION_CREATOR_WORKSPACE_CONFIG_INCOMPLETE");
  });
});
