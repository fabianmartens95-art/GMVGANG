import { describe, expect, it } from "vitest";
import type { CreatorQualification, CreatorQualificationInput } from "@gmvgang/creator-qualification";
import type { CreatorProfile } from "@gmvgang/platform-foundation";
import { createPlatformApiHandler, type PlatformApiDependencies, type PlatformApiServices } from "../src/index.js";

const NOW = "2026-09-17T17:00:00.000Z";
const ORIGIN = "https://app.gmvgang.de";
const profile: CreatorProfile = {
  id: "creator-profile-1",
  userId: "user-1",
  tiktokHandle: "creator.one",
  displayName: "Creator One",
  market: "DE",
  language: "de",
  niche: ["beauty"],
  networkStatus: "profile_complete",
  profileCompletionPercent: 100,
  referralCode: "GMVTEST123",
  createdAt: NOW,
  updatedAt: NOW,
};
const input: CreatorQualificationInput = {
  shopEnabled: "yes",
  shopGmv30dBand: "500_2500",
  contentFormats: ["shoppable_video"],
  productionStyle: "face",
  contentLanguage: "de",
  contentCategories: ["beauty"],
  agencyBinding: "none",
  videosPerWeekBand: "weekly_3_5",
  sampleTurnaroundBand: "days_3_5",
  violationStatus: "none",
};
const qualification: CreatorQualification = {
  id: "qualification-1",
  creatorProfileId: profile.id,
  schemaVersion: "r2-v3.0",
  ...input,
  submittedAt: NOW,
  updatedAt: NOW,
};

function setup(existing: CreatorQualification | null = null) {
  const submissions: CreatorQualificationInput[] = [];
  const services: PlatformApiServices = {
    async resolveSessionContext() {
      return { session: { status: "authenticated", userId: "user-1", roles: ["creator"] }, workspaces: [] };
    },
    async getCreatorProfile() { return profile; },
    async getCreatorQualification() { return existing; },
    async submitCreatorQualification(value) { submissions.push(value); return qualification; },
    async registerCreator() { throw new Error("not_used"); },
    async completeCreatorProfile() { throw new Error("not_used"); },
  };
  const dependencies: PlatformApiDependencies = {
    accessTokens: { async getAccessToken() { return "token"; } },
    services,
    clock: { now: () => NOW },
    privacyNoticeVersion: "2026-09-17",
  };
  return { handler: createPlatformApiHandler(dependencies), submissions };
}

describe("creator qualification HTTP", () => {
  it("returns 404 before an R2 snapshot exists", async () => {
    const { handler } = setup(null);
    const response = await handler(new Request(`${ORIGIN}/api/creator/qualification`));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, errors: ["creator_qualification_not_found"] });
  });

  it("returns the authenticated creator's qualification", async () => {
    const { handler } = setup(qualification);
    const response = await handler(new Request(`${ORIGIN}/api/creator/qualification`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, qualification });
  });

  it("rejects malformed conditional R2 payloads before service writes", async () => {
    const { handler, submissions } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/creator/qualification`, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, contentFormats: ["live_shopping"] }),
    }));
    expect(response.status).toBe(400);
    expect(submissions).toHaveLength(0);
  });

  it("submits a valid R2 payload through the authenticated service boundary", async () => {
    const { handler, submissions } = setup();
    const response = await handler(new Request(`${ORIGIN}/api/creator/qualification`, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json", "Idempotency-Key": "creator-r2-test-0001" },
      body: JSON.stringify(input),
    }));
    expect(response.status).toBe(200);
    expect(submissions).toEqual([input]);
    await expect(response.json()).resolves.toEqual({ ok: true, qualification });
  });
});
