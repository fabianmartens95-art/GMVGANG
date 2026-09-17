import { describe, expect, it } from "vitest";

import { toCreatorBrandPublicProfile } from "./index.js";

describe("toCreatorBrandPublicProfile", () => {
  it("returns only explicitly approved Brand-facing fields", () => {
    const result = toCreatorBrandPublicProfile({
      creatorProfileId: "creator-1",
      displayName: "Creator One",
      tiktokHandle: "creator.one",
      market: "DE",
      language: "de",
      niches: ["Beauty", "Lifestyle"],
      verificationStatus: "verified",
      performance: {
        gmVCents: 123400,
        orders: 42,
        postedContent: 8,
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
      email: "private@example.com",
      referralCode: "SECRETREF",
      creatorMasterId: "notion-page-secret",
      userId: "user-secret",
      internalNotes: "Never expose this.",
    });

    expect(result).toEqual({
      creatorProfileId: "creator-1",
      displayName: "Creator One",
      tiktokHandle: "creator.one",
      market: "DE",
      language: "de",
      niches: ["Beauty", "Lifestyle"],
      verification: "verified",
      performance: {
        gmVCents: 123400,
        orders: 42,
        postedContent: 8,
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("SECRETREF");
    expect(serialized).not.toContain("notion-page-secret");
    expect(serialized).not.toContain("user-secret");
    expect(serialized).not.toContain("Never expose this");
  });

  it("never exposes pending/rejected verification as verified", () => {
    for (const verificationStatus of ["unverified", "pending_review", "rejected"] as const) {
      expect(toCreatorBrandPublicProfile({
        creatorProfileId: "creator-1",
        tiktokHandle: "creator.one",
        verificationStatus,
      }).verification).toBe("not_verified");
    }
  });

  it("falls back to TikTok handle when display name is missing", () => {
    expect(toCreatorBrandPublicProfile({
      creatorProfileId: "creator-1",
      tiktokHandle: "creator.one",
    }).displayName).toBe("creator.one");
  });

  it("fails closed on malformed performance values or timestamps", () => {
    expect(() => toCreatorBrandPublicProfile({
      creatorProfileId: "creator-1",
      tiktokHandle: "creator.one",
      performance: { gmVCents: -1 },
    })).toThrow("CREATOR_PUBLIC_GMV_INVALID");

    expect(() => toCreatorBrandPublicProfile({
      creatorProfileId: "creator-1",
      tiktokHandle: "creator.one",
      performance: { updatedAt: "not-a-date" },
    })).toThrow("CREATOR_PUBLIC_PERFORMANCE_TIMESTAMP_INVALID");
  });
});
