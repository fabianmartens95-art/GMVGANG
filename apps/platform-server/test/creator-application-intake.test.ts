import { describe, expect, it } from "vitest";

import { createCreatorApplicationIntakeHandler } from "../src/creator-application-intake.js";

const API_ORIGIN = "https://app.gmvgang.de";
const WEBSITE_ORIGIN = "https://gmvgang.de";
const PRIVACY_VERSION = "2026-09-16";

function handler() {
  return createCreatorApplicationIntakeHandler({
    supabaseUrl: "https://example.supabase.co",
    supabaseServiceRoleKey: "service-role-test-key",
    privacyNoticeVersion: PRIVACY_VERSION,
    allowedOrigins: [WEBSITE_ORIGIN],
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Creator One",
    email: "creator@example.com",
    phone: "+49 170 1234567",
    tiktokHandle: "@creator.one",
    followerCount: 23456,
    contentCategories: ["Beauty", "Lifestyle"],
    tiktokShopExperience: "affiliate",
    ageConfirmed: true,
    privacyAccepted: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    ...overrides,
  };
}

describe("public Creator application intake", () => {
  it("exposes only the current privacy version to an allowed website origin", async () => {
    const response = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application/config`, {
      headers: { Origin: WEBSITE_ORIGIN },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEBSITE_ORIGIN);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true, privacyNoticeVersion: PRIVACY_VERSION });
  });

  it("rejects unapproved origins before any persistence path", async () => {
    const response = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
        "Idempotency-Key": "creator-app:1234567890abcdef",
      },
      body: JSON.stringify(validPayload()),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, errors: ["origin_not_allowed"] });
  });

  it("returns explicit CORS policy for approved preflight requests", async () => {
    const response = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "OPTIONS",
      headers: { Origin: WEBSITE_ORIGIN },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(WEBSITE_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toContain("Idempotency-Key");
  });

  it("rejects malformed requests and stale privacy consent before database access", async () => {
    const invalidKey = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: WEBSITE_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": "short",
      },
      body: JSON.stringify(validPayload()),
    }));
    expect(invalidKey.status).toBe(400);
    await expect(invalidKey.json()).resolves.toEqual({ ok: false, errors: ["invalid_idempotency_key"] });

    const stalePrivacy = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: WEBSITE_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": "creator-app:1234567890abcdef",
      },
      body: JSON.stringify(validPayload({ privacyNoticeVersion: "2026-08-01" })),
    }));
    expect(stalePrivacy.status).toBe(409);
    await expect(stalePrivacy.json()).resolves.toEqual({ ok: false, errors: ["privacy_notice_version_outdated"] });
  });

  it("requires an exact non-negative integer follower count and 1 to 5 categories", async () => {
    const invalidFollowers = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: WEBSITE_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": "creator-app:1234567890abcdef",
      },
      body: JSON.stringify(validPayload({ followerCount: -1 })),
    }));
    expect(invalidFollowers.status).toBe(400);
    await expect(invalidFollowers.json()).resolves.toEqual({ ok: false, errors: ["invalid_follower_count"] });

    const invalidCategories = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: WEBSITE_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": "creator-app:abcdef1234567890",
      },
      body: JSON.stringify(validPayload({ contentCategories: [] })),
    }));
    expect(invalidCategories.status).toBe(400);
    await expect(invalidCategories.json()).resolves.toEqual({ ok: false, errors: ["invalid_content_categories"] });
  });

  it("silently accepts the honeypot path without touching persistence", async () => {
    const response = await handler()(new Request(`${API_ORIGIN}/api/public/creator-application`, {
      method: "POST",
      headers: {
        Origin: WEBSITE_ORIGIN,
        "Content-Type": "application/json",
        "Idempotency-Key": "creator-app:1234567890abcdef",
      },
      body: JSON.stringify(validPayload({ company: "spam bot inc" })),
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, accepted: true });
  });
});
